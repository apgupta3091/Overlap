// Display-only helpers. Switching the display timezone changes labels and day grouping, never the
// underlying instants. Formatting uses Intl with an explicit timeZone; no manual offset math.
import { Temporal } from 'temporal-polyfill'
import type { EventSlot } from '../../domain/types'

export const DEFAULT_LOCALE = 'en-US'

const formatters = new Map<string, Intl.DateTimeFormat>()
function fmt(tz: string, options: Intl.DateTimeFormatOptions, locale = DEFAULT_LOCALE): Intl.DateTimeFormat {
  const key = `${locale}|${tz}|${JSON.stringify(options)}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone: tz })
    formatters.set(key, f)
  }
  return f
}

const ms = (iso: string) => Temporal.Instant.from(iso).epochMilliseconds

/** The browser's IANA timezone, falling back to UTC. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Local calendar date ("YYYY-MM-DD") of an instant in `tz`. */
export function localDateOf(iso: string, tz: string): string {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(tz).toPlainDate().toString()
}

/** "7:00 PM" */
export function formatTime(iso: string, tz: string): string {
  return fmt(tz, { hour: 'numeric', minute: '2-digit' }).format(ms(iso))
}

/** "7:00 – 8:00 PM" */
export function formatTimeRange(startIso: string, endIso: string, tz: string): string {
  return fmt(tz, { hour: 'numeric', minute: '2-digit' }).formatRange(ms(startIso), ms(endIso))
}

/** "Wed, Mar 17" for an instant in `tz`. */
export function formatDayOfInstant(iso: string, tz: string): string {
  return fmt(tz, { weekday: 'short', month: 'short', day: 'numeric' }).format(ms(iso))
}

/** "Wednesday, March 17" for an instant in `tz`. */
export function formatLongDayOfInstant(iso: string, tz: string): string {
  return fmt(tz, { weekday: 'long', month: 'long', day: 'numeric' }).format(ms(iso))
}

/** "Wed, Mar 17" for a plain local date (no timezone involved). */
export function formatPlainDate(date: string, style: 'short' | 'long' = 'short'): string {
  return Temporal.PlainDate.from(date).toLocaleString(
    DEFAULT_LOCALE,
    style === 'short' ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'long', month: 'long', day: 'numeric' },
  )
}

/** "GMT-5" — the zone's offset at a given instant (offsets vary with DST). */
export function offsetLabel(tz: string, atIso: string): string {
  const part = fmt(tz, { timeZoneName: 'shortOffset' })
    .formatToParts(ms(atIso))
    .find((p) => p.type === 'timeZoneName')
  return part?.value ?? ''
}

/** "America/New York (GMT-5)" — IANA name first; never an ambiguous abbreviation alone. */
export function timeZoneLabel(tz: string, atIso: string = Temporal.Now.instant().toString()): string {
  if (tz === 'UTC' || tz === 'Etc/UTC') return 'UTC'
  const offset = offsetLabel(tz, atIso)
  const name = tz.replace(/_/g, ' ')
  return offset ? `${name} (${offset})` : name
}

export interface DisplaySegment {
  rangeId: string
  slots: EventSlot[]
}

export interface DisplayDay {
  /** Local date in the display timezone. */
  date: string
  label: string
  /** Contiguous runs of slots. Separate segments mean a gap: different candidate ranges or non-adjacent times. */
  segments: DisplaySegment[]
}

/**
 * Group slots by their local start date in the *display* timezone (not by the event's original dates),
 * splitting each day into contiguous segments. A single event date can split across two display days.
 */
export function groupSlotsByDisplayDate(slots: readonly EventSlot[], tz: string): DisplayDay[] {
  const sorted = [...slots].sort((a, b) => ms(a.startAt) - ms(b.startAt))
  const days: DisplayDay[] = []
  let prev: EventSlot | null = null
  for (const slot of sorted) {
    const date = localDateOf(slot.startAt, tz)
    let day = days[days.length - 1]
    if (!day || day.date !== date) {
      day = { date, label: formatPlainDate(date), segments: [] }
      days.push(day)
      prev = null
    }
    const contiguous = prev !== null && prev.rangeId === slot.rangeId && ms(prev.endAt) === ms(slot.startAt)
    if (contiguous) day.segments[day.segments.length - 1]!.slots.push(slot)
    else day.segments.push({ rangeId: slot.rangeId, slots: [slot] })
    prev = slot
  }
  return days
}
