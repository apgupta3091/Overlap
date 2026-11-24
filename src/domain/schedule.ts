// Validates an organizer's candidate dates/ranges and generates the event's concrete UTC slots.
// Runs on the client (instant feedback) and on the server (authoritative; the server never trusts
// client-generated slots).
import { LIMITS, MEETING_DURATIONS, SLOT_MINUTES } from './limits.ts'
import { isValidTimeZone, minutesOfDay, parsePlainDate, resolveLocal, Temporal } from './time.ts'
import type { LocalRangeInput } from './types.ts'

export type ScheduleIssue =
  | { code: 'invalid_timezone' }
  | { code: 'invalid_duration' }
  | { code: 'no_dates' }
  | { code: 'too_many_dates' }
  | { code: 'span_too_long' }
  | { code: 'invalid_date'; date: string }
  | { code: 'duplicate_date'; date: string }
  | { code: 'date_in_past'; date: string }
  | { code: 'range_already_ended'; date: string }
  | { code: 'invalid_time'; date: string }
  | { code: 'off_slot_boundary'; date: string }
  | { code: 'end_not_after_start'; date: string }
  | { code: 'range_too_long'; date: string }
  | { code: 'shorter_than_duration'; date: string }
  | { code: 'nonexistent_time'; date: string; time: string }
  | { code: 'ambiguous_time'; date: string; time: string }
  | { code: 'crosses_dst'; date: string }

export interface GeneratedSlot {
  startAt: string
  endAt: string
  /** Global order across the whole event (0-based, chronological). */
  sortOrder: number
}

export interface GeneratedRange {
  originalLocalDate: string
  startAt: string
  endAt: string
  slots: GeneratedSlot[]
}

export interface GeneratedSchedule {
  ranges: GeneratedRange[]
  expiresAt: string
}

export type ScheduleResult = { ok: true; value: GeneratedSchedule } | { ok: false; issues: ScheduleIssue[] }

export interface ScheduleInput {
  timezone: string
  durationMinutes: number
  ranges: LocalRangeInput[]
}

type RangeCheck =
  | { ok: true; boundaries: Temporal.Instant[] }
  | { ok: false; issue: ScheduleIssue }

/**
 * Validate one same-day range and resolve every 30-minute boundary to an instant.
 * Rejects (never shifts) ranges whose endpoints are skipped/repeated by DST, or that span a DST change.
 */
function checkRange(range: LocalRangeInput, date: Temporal.PlainDate, tz: string, durationMinutes: number): RangeCheck {
  const d = range.date
  const startMin = minutesOfDay(range.start)
  const endMin = minutesOfDay(range.end)
  if (startMin === null || endMin === null || range.start === '24:00') return { ok: false, issue: { code: 'invalid_time', date: d } }
  if (startMin % SLOT_MINUTES !== 0 || endMin % SLOT_MINUTES !== 0) return { ok: false, issue: { code: 'off_slot_boundary', date: d } }
  if (endMin <= startMin) return { ok: false, issue: { code: 'end_not_after_start', date: d } }
  if (endMin - startMin > LIMITS.maxRangeMinutes) return { ok: false, issue: { code: 'range_too_long', date: d } }
  if (endMin - startMin < durationMinutes) return { ok: false, issue: { code: 'shorter_than_duration', date: d } }

  const midnight = date.toPlainDateTime({ hour: 0, minute: 0 })
  const boundaries: Temporal.Instant[] = []
  for (let m = startMin; m <= endMin; m += SLOT_MINUTES) {
    const local = midnight.add({ minutes: m })
    const resolved = resolveLocal(local, tz)
    if (!resolved.ok) {
      const isEndpoint = m === startMin || m === endMin
      if (!isEndpoint) return { ok: false, issue: { code: 'crosses_dst', date: d } }
      const time = m === startMin ? range.start : range.end
      return { ok: false, issue: { code: resolved.reason === 'nonexistent' ? 'nonexistent_time' : 'ambiguous_time', date: d, time } }
    }
    boundaries.push(resolved.instant)
  }
  // Every slot must be exactly 30 real minutes; otherwise an offset change happened inside the range.
  for (let i = 1; i < boundaries.length; i++) {
    const diffMs = boundaries[i]!.epochMilliseconds - boundaries[i - 1]!.epochMilliseconds
    if (diffMs !== SLOT_MINUTES * 60_000) return { ok: false, issue: { code: 'crosses_dst', date: d } }
  }
  return { ok: true, boundaries }
}

/**
 * Validate the whole schedule and generate ranges + slots.
 * `now` is injectable for tests and for the server clock.
 */
export function buildSchedule(input: ScheduleInput, now: Temporal.Instant = Temporal.Now.instant()): ScheduleResult {
  const issues: ScheduleIssue[] = []
  const { timezone: tz, durationMinutes } = input

  if (!isValidTimeZone(tz)) return { ok: false, issues: [{ code: 'invalid_timezone' }] }
  if (!(MEETING_DURATIONS as readonly number[]).includes(durationMinutes)) issues.push({ code: 'invalid_duration' })
  if (input.ranges.length < LIMITS.minDates) return { ok: false, issues: [...issues, { code: 'no_dates' }] }
  if (input.ranges.length > LIMITS.maxDates) return { ok: false, issues: [...issues, { code: 'too_many_dates' }] }

  const today = now.toZonedDateTimeISO(tz).toPlainDate()
  const seen = new Set<string>()
  const parsed: { range: LocalRangeInput; date: Temporal.PlainDate }[] = []
  for (const range of input.ranges) {
    const date = parsePlainDate(range.date)
    if (!date) {
      issues.push({ code: 'invalid_date', date: range.date })
      continue
    }
    if (seen.has(range.date)) {
      issues.push({ code: 'duplicate_date', date: range.date })
      continue
    }
    seen.add(range.date)
    if (Temporal.PlainDate.compare(date, today) < 0) {
      issues.push({ code: 'date_in_past', date: range.date })
      continue
    }
    parsed.push({ range, date })
  }

  parsed.sort((a, b) => Temporal.PlainDate.compare(a.date, b.date))
  if (parsed.length >= 2) {
    const first = parsed[0]!.date
    const last = parsed[parsed.length - 1]!.date
    if (first.until(last, { largestUnit: 'days' }).days > LIMITS.maxSpanDays) issues.push({ code: 'span_too_long' })
  }

  const ranges: GeneratedRange[] = []
  let sortOrder = 0
  for (const { range, date } of parsed) {
    const check = checkRange(range, date, tz, durationMinutes)
    if (!check.ok) {
      issues.push(check.issue)
      continue
    }
    const { boundaries } = check
    const end = boundaries[boundaries.length - 1]!
    if (Temporal.Instant.compare(end, now) <= 0) {
      issues.push({ code: 'range_already_ended', date: range.date })
      continue
    }
    const slots: GeneratedSlot[] = []
    for (let i = 0; i < boundaries.length - 1; i++) {
      slots.push({ startAt: boundaries[i]!.toString(), endAt: boundaries[i + 1]!.toString(), sortOrder: sortOrder++ })
    }
    ranges.push({ originalLocalDate: range.date, startAt: boundaries[0]!.toString(), endAt: end.toString(), slots })
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: { ranges, expiresAt: computeExpiresAt(ranges[ranges.length - 1]!.endAt) } }
}

/** Expiry = end of the final candidate range + 30 days. */
export function computeExpiresAt(lastRangeEndAt: string): string {
  return Temporal.Instant.from(lastRangeEndAt).add({ hours: LIMITS.expiryDays * 24 }).toString()
}

function formatDate(date: string): string {
  const d = parsePlainDate(date)
  return d ? d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : date
}

/** Plain-language explanation for an organizer. */
export function describeIssue(issue: ScheduleIssue): string {
  switch (issue.code) {
    case 'invalid_timezone':
      return 'Choose a valid timezone from the list.'
    case 'invalid_duration':
      return `Meeting length must be ${MEETING_DURATIONS.join(', ')} minutes.`
    case 'no_dates':
      return 'Pick at least one date.'
    case 'too_many_dates':
      return `Pick up to ${LIMITS.maxDates} dates.`
    case 'span_too_long':
      return `Dates must fall within ${LIMITS.maxSpanDays} days of each other.`
    case 'invalid_date':
      return `“${issue.date}” isn’t a valid date.`
    case 'duplicate_date':
      return `${formatDate(issue.date)} is selected twice.`
    case 'date_in_past':
      return `${formatDate(issue.date)} is in the past in the event’s timezone.`
    case 'range_already_ended':
      return `The time range on ${formatDate(issue.date)} has already ended.`
    case 'invalid_time':
      return `Enter a valid start and end time for ${formatDate(issue.date)}.`
    case 'off_slot_boundary':
      return `Times on ${formatDate(issue.date)} must be on the hour or half hour.`
    case 'end_not_after_start':
      return `On ${formatDate(issue.date)}, the end time must be after the start time. Overnight ranges aren’t supported.`
    case 'range_too_long':
      return `The range on ${formatDate(issue.date)} is longer than ${LIMITS.maxRangeMinutes / 60} hours.`
    case 'shorter_than_duration':
      return `The range on ${formatDate(issue.date)} is shorter than the meeting length.`
    case 'nonexistent_time':
      return `${issue.time} doesn’t exist on ${formatDate(issue.date)} because clocks jump forward for daylight saving time. Choose a different time.`
    case 'ambiguous_time':
      return `${issue.time} happens twice on ${formatDate(issue.date)} because clocks fall back for daylight saving time. Choose a different time.`
    case 'crosses_dst':
      return `Daylight saving time changes during the range on ${formatDate(issue.date)}. Choose a range that ends before or starts after the change.`
  }
}
