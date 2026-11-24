// Pure helpers for the creation form's date rows.
import { buildSchedule, type ScheduleIssue } from '../../domain/schedule.ts'
import { Temporal, todayIn } from '../../domain/time.ts'
import { LIMITS } from '../../domain/limits.ts'
import type { LocalRangeInput } from '../../domain/types.ts'

export interface DateRow extends LocalRangeInput {
  key: string
}

let seq = 0
export const rowKey = () => `row-${++seq}`

export function defaultRows(tz: string, now?: Temporal.Instant): DateRow[] {
  const tomorrow = todayIn(tz, now).add({ days: 1 }).toString()
  return [{ key: rowKey(), date: tomorrow, start: '09:00', end: '17:00' }]
}

/** The next row: the day after the latest date, with the same times as the last row. */
export function nextRow(rows: readonly DateRow[], tz: string, now?: Temporal.Instant): DateRow {
  const last = rows[rows.length - 1]
  const dates = rows.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  const latest = dates[dates.length - 1]
  let date: string
  try {
    date = latest ? Temporal.PlainDate.from(latest).add({ days: 1 }).toString() : todayIn(tz, now).add({ days: 1 }).toString()
  } catch {
    date = todayIn(tz, now).add({ days: 1 }).toString()
  }
  return { key: rowKey(), date, start: last?.start ?? '09:00', end: last?.end ?? '17:00' }
}

export const canAddRow = (rows: readonly DateRow[]) => rows.length < LIMITS.maxDates

export interface ScheduleCheck {
  ok: boolean
  slotCount: number
  /** Issues tied to a date, keyed by that date. */
  byDate: Map<string, ScheduleIssue[]>
  /** Issues about the whole schedule. */
  general: ScheduleIssue[]
}

export function checkSchedule(rows: readonly DateRow[], tz: string, durationMinutes: number, now?: Temporal.Instant): ScheduleCheck {
  const result = buildSchedule({ timezone: tz, durationMinutes, ranges: rows.map(({ date, start, end }) => ({ date, start, end })) }, now)
  if (result.ok) {
    return { ok: true, slotCount: result.value.ranges.reduce((n, r) => n + r.slots.length, 0), byDate: new Map(), general: [] }
  }
  const byDate = new Map<string, ScheduleIssue[]>()
  const general: ScheduleIssue[] = []
  for (const issue of result.issues) {
    if ('date' in issue) byDate.set(issue.date, [...(byDate.get(issue.date) ?? []), issue])
    else general.push(issue)
  }
  return { ok: false, slotCount: 0, byDate, general }
}
