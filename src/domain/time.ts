// Timezone-correct conversion between event-local wall-clock times and UTC instants.
// All offset math is delegated to Temporal; we never compute UTC offsets ourselves.
import { Temporal } from 'temporal-polyfill'

export type LocalResolution =
  | { ok: true; instant: Temporal.Instant }
  | { ok: false; reason: 'nonexistent' | 'ambiguous' }

/** True for IANA zone names (incl. "UTC"); false for offsets like "+05:00" and unknown names. */
export function isValidTimeZone(tz: string): boolean {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64 || /^[+-]/.test(tz)) return false
  try {
    Temporal.ZonedDateTime.from({ year: 2000, month: 1, day: 1, timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Resolve a local date-time in `tz` to an instant, refusing to guess.
 * - nonexistent: the wall-clock time is skipped by a DST jump (e.g. 02:30 on spring-forward day).
 * - ambiguous: the wall-clock time occurs twice (e.g. 01:30 on fall-back day).
 */
export function resolveLocal(dateTime: Temporal.PlainDateTime, tz: string): LocalResolution {
  try {
    return { ok: true, instant: dateTime.toZonedDateTime(tz, { disambiguation: 'reject' }).toInstant() }
  } catch (e) {
    if (!(e instanceof RangeError)) throw e
    const earlier = dateTime.toZonedDateTime(tz, { disambiguation: 'earlier' })
    // A skipped time can't round-trip: Temporal moves it out of the gap.
    const roundTrips = Temporal.PlainDateTime.compare(earlier.toPlainDateTime(), dateTime) === 0
    return { ok: false, reason: roundTrips ? 'ambiguous' : 'nonexistent' }
  }
}

export function parsePlainDate(value: string): Temporal.PlainDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  try {
    return Temporal.PlainDate.from(value, { overflow: 'reject' })
  } catch {
    return null
  }
}

/** Parse "HH:MM" (00:00–23:59). "24:00" is handled by callers as end-of-day. */
export function parsePlainTime(value: string): Temporal.PlainTime | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null
  try {
    return Temporal.PlainTime.from(value, { overflow: 'reject' })
  } catch {
    return null
  }
}

/** Minutes since local midnight for "HH:MM" or "24:00"; null if malformed. */
export function minutesOfDay(value: string): number | null {
  if (value === '24:00') return 24 * 60
  const t = parsePlainTime(value)
  return t ? t.hour * 60 + t.minute : null
}

/** Today's date in `tz`. */
export function todayIn(tz: string, now: Temporal.Instant = Temporal.Now.instant()): Temporal.PlainDate {
  return now.toZonedDateTimeISO(tz).toPlainDate()
}

/** Normalize any ISO instant (e.g. Postgres "…+00:00") to canonical "…Z" form. */
export function toIsoInstant(value: string | Temporal.Instant): string {
  return (typeof value === 'string' ? Temporal.Instant.from(value) : value).toString()
}

export function instantMs(iso: string): number {
  return Temporal.Instant.from(iso).epochMilliseconds
}

export { Temporal }
