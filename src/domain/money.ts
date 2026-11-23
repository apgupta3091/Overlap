// Money helpers. All amounts are integer cents; parsing is string-based to avoid float error.

const DOLLARS_PATTERN = /^\$?\s*(\d{1,3}(,\d{3})+|\d+)(\.(\d{1,2}))?$/

/**
 * Parse a user-entered dollar amount (e.g. "2,450", "$2450.5") into integer cents.
 * Returns null for blank input and NaN for invalid input.
 */
export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const match = DOLLARS_PATTERN.exec(trimmed)
  if (!match) return Number.NaN
  const whole = Number(match[1]!.replace(/,/g, ''))
  const fraction = match[4] ? Number(match[4].padEnd(2, '0')) : 0
  const cents = whole * 100 + fraction
  return Number.isSafeInteger(cents) ? cents : Number.NaN
}

/** Convert cents to an editable dollar string ("2450" or "2450.50"). */
export function centsToInput(cents: number | null): string {
  if (cents === null) return ''
  const whole = Math.trunc(cents / 100)
  const fraction = Math.abs(cents % 100)
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`
}

const wholeFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})
const centsFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Format cents as USD; omits ".00" for whole-dollar amounts. */
export function formatCents(cents: number): string {
  return cents % 100 === 0 ? wholeFormatter.format(cents / 100) : centsFormatter.format(cents / 100)
}

/** Format cents, or "Unknown" when null. */
export function formatMaybeCents(cents: number | null): string {
  return cents === null ? 'Unknown' : formatCents(cents)
}
