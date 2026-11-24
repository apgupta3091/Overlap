import { describe, expect, it } from 'vitest'
import { buildSchedule } from '../../domain/schedule'
import { Temporal } from '../../domain/time'
import type { EventSlot, LocalRangeInput } from '../../domain/types'
import { formatTime, formatTimeRange, groupSlotsByDisplayDate, localDateOf, timeZoneLabel } from './display'

const NOW = Temporal.Instant.from('2027-01-01T00:00:00Z')

function slotsFor(timezone: string, ranges: LocalRangeInput[]): EventSlot[] {
  const r = buildSchedule({ timezone, durationMinutes: 30, ranges }, NOW)
  if (!r.ok) throw new Error(JSON.stringify(r.issues))
  return r.value.ranges.flatMap((range, ri) =>
    range.slots.map((s) => ({ id: `s${s.sortOrder}`, rangeId: `r${ri}`, startAt: s.startAt, endAt: s.endAt, sortOrder: s.sortOrder })),
  )
}

describe('groupSlotsByDisplayDate', () => {
  // Auckland (NZST, UTC+12) Jun 10 18:00–22:00 = Jun 10 06:00–10:00Z = Los Angeles (PDT) Jun 9 23:00 → Jun 10 03:00.
  const slots = slotsFor('Pacific/Auckland', [{ date: '2027-06-10', start: '18:00', end: '22:00' }])

  it('keeps one day in the event timezone', () => {
    const days = groupSlotsByDisplayDate(slots, 'Pacific/Auckland')
    expect(days.map((d) => [d.date, d.segments.length, d.segments[0]!.slots.length])).toEqual([['2027-06-10', 1, 8]])
  })

  it('splits one event date across two local dates for a viewer elsewhere', () => {
    const days = groupSlotsByDisplayDate(slots, 'America/Los_Angeles')
    expect(days.map((d) => d.date)).toEqual(['2027-06-09', '2027-06-10'])
    expect(days.map((d) => d.segments.flatMap((s) => s.slots).length)).toEqual([2, 6])
    expect(days[0]!.label).toBe('Wed, Jun 9')
  })

  it('never changes the underlying instants when the display timezone changes', () => {
    const ids = (tz: string) => groupSlotsByDisplayDate(slots, tz).flatMap((d) => d.segments.flatMap((s) => s.slots.map((x) => x.startAt)))
    expect(ids('America/Los_Angeles')).toEqual(ids('Pacific/Auckland'))
    expect(ids('UTC')).toEqual(slots.map((s) => s.startAt))
  })

  it('separates different candidate ranges that land on the same display day', () => {
    // Kiritimati is UTC+14: Jun 10 22:00 and Jun 11 00:00 local are both Jun 10 in UTC, with a gap between them.
    const k = slotsFor('Pacific/Kiritimati', [
      { date: '2027-06-10', start: '22:00', end: '23:00' },
      { date: '2027-06-11', start: '00:00', end: '01:00' },
    ])
    const days = groupSlotsByDisplayDate(k, 'UTC')
    expect(days).toHaveLength(1)
    expect(days[0]!.segments.map((s) => [s.rangeId, s.slots.length])).toEqual([
      ['r0', 2],
      ['r1', 2],
    ])
  })
})

describe('labels', () => {
  it('formats times in the requested zone', () => {
    expect(formatTime('2027-06-10T06:00:00Z', 'America/Los_Angeles')).toMatch(/^11:00\sPM$/u)
    expect(formatTime('2027-06-10T06:00:00Z', 'Pacific/Auckland')).toMatch(/^6:00\sPM$/u)
    expect(formatTimeRange('2027-06-10T06:00:00Z', '2027-06-10T07:00:00Z', 'Pacific/Auckland')).toMatch(/6:00\s?–\s?7:00\sPM/u)
    expect(formatTimeRange('2027-06-10T23:00:00Z', '2027-06-11T00:00:00Z', 'UTC')).toMatch(/^11:00\sPM – 12:00\sAM \(next day\)$/u)
    expect(localDateOf('2027-06-10T06:00:00Z', 'America/Los_Angeles')).toBe('2027-06-09')
  })

  it('labels zones with the IANA name and the offset in effect at that instant', () => {
    expect(timeZoneLabel('America/New_York', '2027-01-15T12:00:00Z')).toBe('America/New York (GMT-5)')
    expect(timeZoneLabel('America/New_York', '2027-07-15T12:00:00Z')).toBe('America/New York (GMT-4)')
    expect(timeZoneLabel('UTC', '2027-07-15T12:00:00Z')).toBe('UTC')
  })
})
