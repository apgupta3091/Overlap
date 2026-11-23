// Date/time helpers. Tours are stored in UTC with the IANA timezone they were entered in.

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Convert a `datetime-local` value (interpreted in the browser's timezone) to a UTC ISO string. */
export function localInputToUtc(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Convert a UTC ISO string to a `datetime-local` value in the browser's timezone. */
export function utcToLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function safeFormat(iso: string, options: Intl.DateTimeFormatOptions, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('en-US', options).format(new Date(iso))
  }
}

/** "Thu, Nov 26, 6:30 PM" in the given timezone (defaults to the browser's). */
export function formatTourDateTime(iso: string, timeZone?: string): string {
  return safeFormat(iso, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }, timeZone)
}

export function formatShortDate(iso: string): string {
  return safeFormat(iso, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** For date-only values (YYYY-MM-DD) — avoid timezone shifts by formatting at UTC. */
export function formatDateOnly(date: string): string {
  return safeFormat(`${date}T00:00:00Z`, { month: 'short', day: 'numeric', year: 'numeric' }, 'UTC')
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime()
  const abs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (abs < minute) return 'just now'
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute')
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
  if (abs < 7 * day) return rtf.format(Math.round(diffMs / day), 'day')
  return formatShortDate(iso)
}

/** Short timezone label, e.g. "EST" or "GMT+1"; falls back to the IANA name. */
export function timeZoneAbbreviation(iso: string, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(new Date(iso))
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  } catch {
    return timeZone
  }
}
