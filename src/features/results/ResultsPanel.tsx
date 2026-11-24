import { useMemo, useState } from 'react'
import { Star, Users } from 'lucide-react'
import { EmptyState } from '../../components/ui/States'
import { describeAttendance, describeResponseCount, displayLabels, heatLevel, HEAT_LEVELS, tallySlots, type SlotTally } from '../../domain/results.ts'
import { suggestWindows } from '../../domain/windows.ts'
import type { EventSlot, OverlapEvent, ParticipantResponse, ScoredWindow } from '../../domain/types'
import { formatLongDayOfInstant, formatTimeRange } from '../../lib/time/display'
import { buildSlotGrid } from '../../lib/time/grid'
import { SlotTable } from '../grid/SlotTable'

const HEAT_CLASSES = [
  'bg-heat-0 text-ink-faint',
  'bg-heat-1 text-ink',
  'bg-heat-2 text-ink',
  'bg-heat-3 text-ink',
  'bg-heat-4 text-white',
  'bg-heat-5 text-white',
] as const

interface Props {
  event: OverlapEvent
  responses: readonly ParticipantResponse[]
  timeZone: string
  myResponseId: string | undefined
  /** Rendered when nobody has responded yet (e.g. a share prompt). */
  emptyAction?: React.ReactNode
}

function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

export function ResultsPanel({ event, responses, timeZone, myResponseId, emptyAction }: Props) {
  const tallies = useMemo(() => tallySlots(event.slots, responses), [event.slots, responses])
  const suggestions = useMemo(() => suggestWindows(event.slots, responses, event.durationMinutes), [event.slots, responses, event.durationMinutes])
  const labels = useMemo(() => {
    const base = displayLabels(responses)
    if (myResponseId && base.has(myResponseId)) base.set(myResponseId, `${base.get(myResponseId)} (you)`)
    return base
  }, [responses, myResponseId])
  const layout = useMemo(() => buildSlotGrid(event.slots, timeZone), [event.slots, timeZone])
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<number | null>(null)

  const n = responses.length
  const highlighted = highlight !== null ? suggestions[highlight] : undefined
  const highlightedIds = new Set(highlighted?.slotIds ?? [])
  const selectedSlot = event.slots.find((s) => s.id === selectedSlotId) ?? null
  const nameOf = (id: string) => labels.get(id) ?? 'Someone'

  if (n === 0) {
    return (
      <EmptyState icon={<Users aria-hidden className="size-6" />} title="No responses yet" action={emptyAction}>
        Results appear here as soon as someone marks their times.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-10">
      <p className="text-sm text-ink-muted">{describeResponseCount(n, event.expectedParticipants)}.</p>

      <section aria-labelledby="best-heading" className="space-y-3">
        <h2 id="best-heading" className="text-lg font-semibold">
          Best {event.durationMinutes}-minute times
        </h2>
        {suggestions.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-[15px] text-ink-muted">
            No {event.durationMinutes}-minute stretch works for anyone yet. More responses may change that, or the organizer could add other times.
          </p>
        ) : (
          <ol className="grid gap-3 md:grid-cols-3">
            {suggestions.map((w, i) => (
              <SuggestionCard
                key={w.startAt}
                rank={i + 1}
                window={w}
                total={n}
                timeZone={timeZone}
                nameOf={nameOf}
                active={highlight === i}
                onToggle={() => setHighlight((h) => (h === i ? null : i))}
              />
            ))}
          </ol>
        )}
        <p className="text-xs text-ink-faint">
          Ranked by how many people can attend the whole time, then how many prefer it, then the earliest. Suggestions don’t overlap.
        </p>
      </section>

      <section aria-labelledby="heat-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="heat-heading" className="text-lg font-semibold">
            Everyone’s availability
          </h2>
          <HeatLegend total={n} />
        </div>
        <p className="text-sm text-ink-muted">Each number is how many people can make that half-hour. Select a time to see who.</p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <SlotTable
            layout={layout}
            label="Group availability by time"
            renderCell={(slot, props) => {
              const t = tallies.get(slot.id)!
              const level = heatLevel(t.availableCount, n)
              const selected = slot.id === selectedSlotId
              const inSuggestion = highlightedIds.has(slot.id)
              return (
                <button
                  {...props}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${formatLongDayOfInstant(slot.startAt, timeZone)}, ${formatTimeRange(slot.startAt, slot.endAt, timeZone)}: ${describeAttendance(t.availableCount, n)}${t.preferredCount ? `, ${t.preferredCount} prefer` : ''}`}
                  onClick={() => setSelectedSlotId(selected ? null : slot.id)}
                  className={`relative flex h-7 w-full items-center justify-center rounded-[5px] text-xs font-semibold tabular-nums transition-shadow sm:h-6 ${HEAT_CLASSES[level]} ${
                    selected ? 'ring-2 ring-ink ring-offset-1 ring-offset-canvas' : inSuggestion ? 'ring-2 ring-accent ring-offset-1 ring-offset-canvas' : ''
                  }`}
                >
                  {t.availableCount}
                  {t.preferredCount > 0 && <Star aria-hidden className="absolute top-0.5 right-0.5 size-2 fill-current opacity-80" />}
                </button>
              )
            }}
          />
          <SlotDetails slot={selectedSlot} tally={selectedSlot ? tallies.get(selectedSlot.id) : undefined} total={n} timeZone={timeZone} nameOf={nameOf} />
        </div>
      </section>

      <section aria-labelledby="people-heading" className="space-y-3">
        <h2 id="people-heading" className="text-lg font-semibold">
          Who’s responded
        </h2>
        <ul className="flex flex-wrap gap-2">
          {[...responses]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((r) => {
              const count = Object.keys(r.slots).length
              return (
                <li key={r.id} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                  <span className="font-medium">{nameOf(r.id)}</span>
                  <span className="text-ink-muted"> · {r.noneWork ? 'none of these times work' : `${count} ${count === 1 ? 'slot' : 'slots'}`}</span>
                </li>
              )
            })}
        </ul>
      </section>
    </div>
  )
}

function SuggestionCard({
  rank,
  window: w,
  total,
  timeZone,
  nameOf,
  active,
  onToggle,
}: {
  rank: number
  window: ScoredWindow
  total: number
  timeZone: string
  nameOf: (id: string) => string
  active: boolean
  onToggle: () => void
}) {
  const missing = w.unavailableIds.map(nameOf)
  return (
    <li className={`flex flex-col rounded-xl border bg-surface p-4 shadow-card ${active ? 'border-accent' : 'border-line'}`}>
      <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{rank === 1 ? 'Top pick' : `Option ${rank}`}</p>
      <p className="mt-1 font-semibold">{formatLongDayOfInstant(w.startAt, timeZone)}</p>
      <p className="text-[15px]">{formatTimeRange(w.startAt, w.endAt, timeZone)}</p>
      <p className="mt-2 text-sm font-medium text-good">{describeAttendance(w.availableIds.length, total)}</p>
      {w.preferredIds.length > 0 && (
        <p className="text-sm text-ink-muted">
          <Star aria-hidden className="mr-1 inline size-3.5 -translate-y-px fill-pref text-pref" />
          {w.preferredIds.length === 1 ? '1 prefers this time' : `${w.preferredIds.length} prefer this time`}
        </p>
      )}
      <p className="mt-1 text-sm text-ink-muted">{missing.length === 0 ? 'Works for everyone who responded.' : `Can’t make it: ${joinNames(missing)}`}</p>
      <button
        type="button"
        aria-pressed={active}
        onClick={onToggle}
        className="mt-3 self-start rounded text-sm font-medium text-accent underline-offset-2 hover:underline"
      >
        {active ? 'Hide on grid' : 'Show on grid'}
      </button>
    </li>
  )
}

function SlotDetails({
  slot,
  tally,
  total,
  timeZone,
  nameOf,
}: {
  slot: EventSlot | null
  tally: SlotTally | undefined
  total: number
  timeZone: string
  nameOf: (id: string) => string
}) {
  return (
    <aside aria-live="polite" className="h-fit rounded-xl border border-line bg-surface p-4 text-sm lg:sticky lg:top-4">
      {!slot || !tally ? (
        <p className="text-ink-muted">Select a time on the grid to see who can make it.</p>
      ) : (
        <>
          <h3 className="font-semibold">{formatLongDayOfInstant(slot.startAt, timeZone)}</h3>
          <p className="text-ink-muted">{formatTimeRange(slot.startAt, slot.endAt, timeZone)}</p>
          <p className="mt-2 font-medium">{describeAttendance(tally.availableCount, total)}</p>
          <NameList title="Prefer" ids={tally.preferredIds} nameOf={nameOf} icon />
          <NameList title="Available" ids={tally.availableOnlyIds} nameOf={nameOf} />
          <NameList title="Can’t make it" ids={tally.unavailableIds} nameOf={nameOf} muted />
        </>
      )}
    </aside>
  )
}

function NameList({ title, ids, nameOf, icon, muted }: { title: string; ids: string[]; nameOf: (id: string) => string; icon?: boolean; muted?: boolean }) {
  if (ids.length === 0) return null
  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
        {title} ({ids.length})
      </h4>
      <ul className={`mt-1 space-y-0.5 ${muted ? 'text-ink-muted' : ''}`}>
        {ids.map((id) => (
          <li key={id}>
            {icon && <Star aria-hidden className="mr-1 inline size-3 -translate-y-px fill-pref text-pref" />}
            {nameOf(id)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function HeatLegend({ total }: { total: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-ink-muted" aria-hidden>
      <span>0</span>
      <span className="flex gap-0.5">
        {Array.from({ length: HEAT_LEVELS + 1 }, (_, i) => (
          <span key={i} className={`h-3 w-5 rounded-sm ${HEAT_CLASSES[i]!.split(' ')[0]}`} />
        ))}
      </span>
      <span>{total}</span>
    </div>
  )
}
