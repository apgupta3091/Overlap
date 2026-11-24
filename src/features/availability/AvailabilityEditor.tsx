import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Check, Star, Undo2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FormError, TextField } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { checkSubmission, countSelected, restoreAvailability, serializeAvailability, type Availability } from '../../domain/availability.ts'
import { LIMITS } from '../../domain/limits.ts'
import { enumerateWindows } from '../../domain/windows.ts'
import type { OverlapEvent, ParticipantResponse } from '../../domain/types'
import { useClient } from '../../data/client'
import { getCredentials } from '../../data/credentials'
import { clearDraft, loadDraft, saveDraft } from '../../data/drafts'
import { errorMessage } from '../../data/errors'
import { useSaveResponse } from '../../data/hooks'
import { checkName } from '../../data/validate'
import { AvailabilityGrid, type Brush } from './AvailabilityGrid'

interface Props {
  event: OverlapEvent
  responses: readonly ParticipantResponse[]
  timeZone: string
  onSaved: () => void
}

interface EditorState {
  displayName: string
  noneWork: boolean
  availability: Availability
}

function fromResponse(r: ParticipantResponse | undefined): EditorState {
  return { displayName: r?.displayName ?? '', noneWork: r?.noneWork ?? false, availability: r ? { ...r.slots } : {} }
}

export function AvailabilityEditor({ event, responses, timeZone, onSaved }: Props) {
  const { store } = useClient()
  const toast = useToast()
  const save = useSaveResponse(event.publicId)
  const instructionsId = useId()
  const slotIds = useMemo(() => new Set(event.slots.map((s) => s.id)), [event.slots])

  const mine = responses.find((r) => r.id === getCredentials(store, event.publicId).responseId)
  const [initial] = useState(() => {
    const draft = loadDraft(store, event.publicId)
    if (draft) {
      return {
        restored: true,
        state: { displayName: draft.displayName, noneWork: draft.noneWork, availability: restoreAvailability(draft.availability, slotIds) },
      }
    }
    return { restored: false, state: fromResponse(mine) }
  })
  const [displayName, setDisplayName] = useState(initial.state.displayName)
  const [noneWork, setNoneWork] = useState(initial.state.noneWork)
  const [availability, setAvailability] = useState<Availability>(initial.state.availability)
  const [brush, setBrush] = useState<Brush>('available')
  const [dirty, setDirty] = useState(initial.restored)
  const [attempted, setAttempted] = useState(false)

  // Keep unsaved work in this browser.
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (!touched) return
    saveDraft(store, event.publicId, {
      displayName,
      noneWork,
      availability: serializeAvailability(availability, event.slots),
      savedAt: new Date().toISOString(),
    })
  }, [touched, displayName, noneWork, availability, store, event.publicId, event.slots])

  const markTouched = () => {
    setTouched(true)
    setDirty(true)
  }

  const effective = noneWork ? {} : availability
  const selected = countSelected(availability)
  const preferred = Object.values(availability).filter((s) => s === 'preferred').length
  const coversMeeting = useMemo(
    () => enumerateWindows(event.slots, event.durationMinutes).some((w) => w.slotIds.every((id) => availability[id])),
    [event.slots, event.durationMinutes, availability],
  )

  const nameError = checkName(displayName)
  const submissionIssue = checkSubmission(effective, noneWork)
  const submissionMessage = submissionIssue === 'empty' ? 'Mark at least one time that works, or check “None of these times work for me”.' : null

  function discard() {
    clearDraft(store, event.publicId)
    const s = fromResponse(mine)
    setDisplayName(s.displayName)
    setNoneWork(s.noneWork)
    setAvailability(s.availability)
    setTouched(false)
    setDirty(false)
    setAttempted(false)
    save.reset()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (nameError || submissionIssue) {
      if (nameError) requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    try {
      const { created } = await save.mutateAsync({ displayName, noneWork, availability: serializeAvailability(effective, event.slots) })
      setTouched(false)
      setDirty(false)
      setAttempted(false)
      toast.success(created ? 'Thanks! Your availability is in.' : 'Your changes are saved.')
      onSaved()
    } catch {
      // Shown inline via save.error.
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      {initial.restored && dirty && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2.5 text-sm text-warn">
          <span>We restored changes you hadn’t submitted yet.</span>
          <Button size="sm" variant="ghost" icon={<Undo2 aria-hidden className="size-4" />} onClick={discard}>
            Discard
          </Button>
        </div>
      )}

      <TextField
        label="Your name"
        hint="Shown to everyone with the link. A first name is enough."
        autoComplete="given-name"
        wrapperClassName="max-w-sm"
        value={displayName}
        maxLength={LIMITS.participantNameMax + 20}
        onChange={(e) => {
          setDisplayName(e.target.value)
          markTouched()
        }}
        error={attempted ? (nameError ?? undefined) : undefined}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <fieldset disabled={noneWork}>
            <legend className="mb-1.5 text-sm font-medium">Mark times as</legend>
            <div className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5">
              {(
                [
                  ['available', 'Available', <Check key="i" aria-hidden className="size-4" strokeWidth={3} />],
                  ['preferred', 'Preferred', <Star key="i" aria-hidden className="size-4 fill-current" />],
                ] as const
              ).map(([value, label, icon]) => (
                <label
                  key={value}
                  className={`relative inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                    brush === value ? (value === 'preferred' ? 'bg-pref text-pref-ink' : 'bg-avail text-avail-ink') : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <input type="radio" name="brush" value={value} checked={brush === value} onChange={() => setBrush(value)} className="sr-only" />
                  {icon}
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {selected > 0 && !noneWork && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAvailability({})
                markTouched()
              }}
            >
              Clear all
            </Button>
          )}
        </div>
        <p id={instructionsId} className="text-sm text-ink-muted">
          Click or drag across the times that work. <strong className="font-medium text-ink">Preferred</strong> means it works best for you. On a phone,
          tap each time. With a keyboard, use the arrow keys and press Space.
        </p>

        <AvailabilityGrid
          slots={event.slots}
          timeZone={timeZone}
          value={availability}
          onChange={(next) => {
            setAvailability(next)
            markTouched()
          }}
          brush={brush}
          disabled={noneWork}
          describedBy={instructionsId}
          onToggle={(_, state) => toast.announce(state === 'preferred' ? 'Marked preferred' : state === 'available' ? 'Marked available' : 'Cleared')}
        />

        <p className="text-sm text-ink-muted" aria-live="polite">
          {noneWork
            ? 'You’ve said none of these times work.'
            : selected === 0
              ? 'No times marked yet.'
              : `${selected} half-hour ${selected === 1 ? 'slot' : 'slots'} marked${preferred > 0 ? `, ${preferred} preferred` : ''}.`}
          {!noneWork && selected > 0 && !coversMeeting && (
            <span className="text-warn"> None of your marked times covers a full {event.durationMinutes}-minute meeting.</span>
          )}
        </p>

        <label className="flex items-start gap-2.5 text-[15px]">
          <input
            type="checkbox"
            checked={noneWork}
            onChange={(e) => {
              setNoneWork(e.target.checked)
              markTouched()
            }}
            className="mt-1 size-4 accent-accent"
          />
          <span>
            None of these times work for me
            {noneWork && selected > 0 && <span className="block text-sm text-ink-muted">Your marked times are kept here in case you change your mind, but won’t be submitted.</span>}
          </span>
        </label>
      </div>

      <div className="sticky bottom-0 -mx-4 space-y-3 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <FormError message={save.error ? errorMessage(save.error) : attempted ? submissionMessage : null} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={save.isPending}>
            {mine ? 'Save changes' : 'Submit availability'}
          </Button>
          {mine && dirty && !initial.restored && (
            <Button variant="ghost" onClick={discard}>
              Discard changes
            </Button>
          )}
          {mine && !dirty && <span className="text-sm text-ink-muted">Your response is saved. Edit any time from this browser.</span>}
        </div>
      </div>
    </form>
  )
}
