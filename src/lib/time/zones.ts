import { Temporal } from 'temporal-polyfill'
import { isValidTimeZone } from '../../domain/time.ts'
import { offsetLabel } from './display'

let cached: string[] | null = null

/** All IANA zones the runtime knows, plus UTC. */
export function allTimeZones(): string[] {
  if (cached) return cached
  let zones: string[] = []
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = []
  }
  const set = new Set(zones.filter((z) => isValidTimeZone(z)))
  set.add('UTC')
  cached = [...set].sort()
  return cached
}

export interface ZoneOption {
  value: string
  label: string
}

/** Select options: pinned zones first (deduplicated), then all others. Labels include the current offset. */
export function timeZoneOptions(pinned: string[] = [], at: string = Temporal.Now.instant().toString()): ZoneOption[] {
  const label = (z: string) => (z === 'UTC' ? 'UTC' : `${z.replace(/_/g, ' ')} (${offsetLabel(z, at)})`)
  const seen = new Set<string>()
  const out: ZoneOption[] = []
  for (const z of [...pinned, ...allTimeZones()]) {
    if (seen.has(z) || !isValidTimeZone(z)) continue
    seen.add(z)
    out.push({ value: z, label: label(z) })
  }
  return out
}

/** "HH:MM" every 30 minutes. `includeEndOfDay` adds "24:00". */
export function halfHourOptions({ from = 0, includeEndOfDay = false }: { from?: number; includeEndOfDay?: boolean } = {}): ZoneOption[] {
  const out: ZoneOption[] = []
  const last = includeEndOfDay ? 48 : 47
  for (let i = from; i <= last; i++) {
    const h = Math.floor(i / 2)
    const m = (i % 2) * 30
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const label =
      i === 48 ? '12:00 AM (end of day)' : Temporal.PlainTime.from({ hour: h, minute: m }).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })
    out.push({ value, label })
  }
  return out
}
