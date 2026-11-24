import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { CalendarPlus, Plus, Trash2 } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { FormError, SelectField, TextAreaField, TextField } from '../../components/ui/Field'
import { describeIssue } from '../../domain/schedule.ts'
import { LIMITS, MEETING_DURATIONS } from '../../domain/limits.ts'
import { todayIn } from '../../domain/time.ts'
import { errorMessage } from '../../data/errors'
import { useCreateEvent } from '../../data/hooks'
import { checkDescription, checkExpected, checkName, checkTitle } from '../../domain/fields.ts'
import { browserTimeZone } from '../../lib/time/display'
import { halfHourOptions, timeZoneOptions } from '../../lib/time/zones'
import { canAddRow, checkSchedule, defaultRows, nextRow, type DateRow } from './scheduleForm'

const START_OPTIONS = halfHourOptions()
const END_OPTIONS = halfHourOptions({ from: 1, includeEndOfDay: true })
const DURATION_OPTIONS = MEETING_DURATIONS.map((m) => ({ value: String(m), label: m < 60 ? `${m} minutes` : m === 60 ? '1 hour' : `${m / 60} hours` }))

export function CreateEventForm() {
  const navigate = useNavigate()
  const create = useCreateEvent()
  const initialTz = useMemo(() => browserTimeZone(), [])
  const zoneOptions = useMemo(() => timeZoneOptions([initialTz]), [initialTz])

  const [title, setTitle] = useState('')
  const [organizerName, setOrganizerName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('60')
  const [timezone, setTimezone] = useState(initialTz)
  const [expected, setExpected] = useState('')
  const [rows, setRows] = useState<DateRow[]>(() => defaultRows(initialTz))
  const [attempted, setAttempted] = useState(false)

  const fieldErrors = {
    title: checkTitle(title),
    organizerName: checkName(organizerName, LIMITS.organizerNameMax),
    description: checkDescription(description),
    expected: checkExpected(expected),
  }
  const schedule = checkSchedule(rows, timezone, Number(duration))
  const show = (msg: string | null) => (attempted ? (msg ?? undefined) : undefined)
  const minDate = todayIn(timezone).toString()

  const updateRow = (key: string, patch: Partial<DateRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (Object.values(fieldErrors).some(Boolean) || !schedule.ok) {
      // Move focus to the first invalid control so keyboard and screen-reader users land on the problem.
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    try {
      const { publicId } = await create.mutateAsync({
        title,
        organizerName,
        description: description.trim() || null,
        timezone,
        durationMinutes: Number(duration),
        expectedParticipants: expected.trim() === '' ? null : Number(expected),
        ranges: rows.map(({ date, start, end }) => ({ date, start, end })),
      })
      navigate(`/e/${publicId}`, { state: { justCreated: true } })
    } catch {
      // Shown inline via create.error.
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-8">
      <fieldset className="space-y-5">
        <legend className="mb-4 text-lg font-semibold">About the event</legend>
        <TextField
          label="Event title"
          placeholder="Chem 101 study session"
          value={title}
          maxLength={LIMITS.titleMax + 20}
          onChange={(e) => setTitle(e.target.value)}
          error={show(fieldErrors.title)}
        />
        <TextField
          label="Your name"
          hint="Shown to your group as the organizer."
          autoComplete="given-name"
          value={organizerName}
          maxLength={LIMITS.organizerNameMax + 20}
          onChange={(e) => setOrganizerName(e.target.value)}
          error={show(fieldErrors.organizerName)}
        />
        <TextAreaField
          label="Description"
          optional
          rows={3}
          placeholder="What it’s for, where you’ll meet, anything to bring."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          hint={`${description.trim().length}/${LIMITS.descriptionMax}`}
          error={show(fieldErrors.description)}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Meeting length" options={DURATION_OPTIONS} value={duration} onChange={(e) => setDuration(e.target.value)} />
          <TextField
            label="How many people?"
            optional
            inputMode="numeric"
            placeholder="e.g. 6"
            hint="Only used to show how many have responded."
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            error={show(fieldErrors.expected)}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-semibold">When could it happen?</legend>
        <p className="text-sm text-ink-muted">
          Pick up to {LIMITS.maxDates} dates within {LIMITS.maxSpanDays} days, each with a window of up to {LIMITS.maxRangeMinutes / 60} hours. Your group will mark which half-hours work.
        </p>
        <SelectField
          label="Timezone for these times"
          hint="Everyone else sees times converted to their own timezone."
          options={zoneOptions}
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          error={schedule.general.some((i) => i.code === 'invalid_timezone') ? show(describeIssue({ code: 'invalid_timezone' })) : undefined}
        />

        <ol className="space-y-3">
          {rows.map((row, i) => {
            const issues = schedule.byDate.get(row.date) ?? []
            const message = attempted && issues.length > 0 ? issues.map(describeIssue).join(' ') : undefined
            return (
              <li key={row.key} className={`rounded-xl border bg-surface p-3 sm:p-4 ${message ? 'border-bad/40' : 'border-line'}`}>
                <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                  <TextField
                    type="date"
                    label={`Date ${i + 1}`}
                    min={minDate}
                    value={row.date}
                    onChange={(e) => updateRow(row.key, { date: e.target.value })}
                    wrapperClassName="col-span-2 sm:col-span-1"
                    aria-invalid={message ? true : undefined}
                  />
                  <SelectField label="From" options={START_OPTIONS} value={row.start} onChange={(e) => updateRow(row.key, { start: e.target.value })} />
                  <SelectField label="Until" options={END_OPTIONS} value={row.end} onChange={(e) => updateRow(row.key, { end: e.target.value })} />
                  {rows.length > 1 && (
                    <IconButton
                      label={`Remove date ${i + 1}`}
                      className="col-span-2 justify-self-end sm:col-span-1 sm:mt-6"
                      onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </IconButton>
                  )}
                </div>
                {message && <p className="mt-2 text-sm text-bad">{message}</p>}
              </li>
            )
          })}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            icon={<Plus aria-hidden className="size-4" />}
            disabled={!canAddRow(rows)}
            onClick={() => setRows((rs) => [...rs, nextRow(rs, timezone)])}
          >
            Add another date
          </Button>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {!canAddRow(rows) ? `That’s the maximum of ${LIMITS.maxDates} dates.` : schedule.ok ? `${rows.length} ${rows.length === 1 ? 'date' : 'dates'}, ${schedule.slotCount} half-hour slots` : ''}
          </p>
        </div>
        {attempted && schedule.general.filter((i) => i.code !== 'invalid_timezone').length > 0 && (
          <FormError message={schedule.general.filter((i) => i.code !== 'invalid_timezone').map(describeIssue).join(' ')} />
        )}
      </fieldset>

      <div className="space-y-3 border-t border-line pt-6">
        <FormError message={create.error ? errorMessage(create.error) : null} />
        {attempted && (Object.values(fieldErrors).some(Boolean) || !schedule.ok) && (
          <p role="alert" className="text-sm text-bad">Fix the highlighted fields to continue.</p>
        )}
        <Button type="submit" variant="primary" loading={create.isPending} icon={<CalendarPlus aria-hidden className="size-4" />}>
          Create event
        </Button>
      </div>
    </form>
  )
}
