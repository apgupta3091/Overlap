import { describe, expect, it } from 'vitest'
import { buildSchedule, describeIssue, type ScheduleInput, type ScheduleIssue } from './schedule'
import { Temporal } from './time'

const NOW = Temporal.Instant.from('2027-01-01T12:00:00Z')

function build(partial: Partial<ScheduleInput> & Pick<ScheduleInput, 'ranges'>, now = NOW) {
  return buildSchedule({ timezone: 'America/New_York', durationMinutes: 60, ...partial }, now)
}
function issues(partial: Partial<ScheduleInput> & Pick<ScheduleInput, 'ranges'>, now = NOW): ScheduleIssue[] {
  const r = build(partial, now)
  if (r.ok) throw new Error('expected failure')
  return r.issues
}
function ok(partial: Partial<ScheduleInput> & Pick<ScheduleInput, 'ranges'>, now = NOW) {
  const r = build(partial, now)
  if (!r.ok) throw new Error(`expected success, got ${JSON.stringify(r.issues)}`)
  return r.value
}

describe('buildSchedule — slot generation', () => {
  it('generates 30-minute UTC slots for an ordinary range', () => {
    const s = ok({ ranges: [{ date: '2027-03-10', start: '18:00', end: '21:00' }] })
    expect(s.ranges).toHaveLength(1)
    const [range] = s.ranges
    expect(range!.originalLocalDate).toBe('2027-03-10')
    expect(range!.startAt).toBe('2027-03-10T23:00:00Z') // EST = UTC-5
    expect(range!.endAt).toBe('2027-03-11T02:00:00Z')
    expect(range!.slots.map((x) => x.startAt)).toEqual([
      '2027-03-10T23:00:00Z',
      '2027-03-10T23:30:00Z',
      '2027-03-11T00:00:00Z',
      '2027-03-11T00:30:00Z',
      '2027-03-11T01:00:00Z',
      '2027-03-11T01:30:00Z',
    ])
    expect(range!.slots.map((x) => x.sortOrder)).toEqual([0, 1, 2, 3, 4, 5])
    expect(s.expiresAt).toBe('2027-04-10T02:00:00Z')
  })

  it('sorts dates and numbers slots continuously across ranges', () => {
    const s = ok({
      ranges: [
        { date: '2027-03-12', start: '09:00', end: '10:00' },
        { date: '2027-03-10', start: '09:00', end: '10:00' },
      ],
    })
    expect(s.ranges.map((r) => r.originalLocalDate)).toEqual(['2027-03-10', '2027-03-12'])
    expect(s.ranges.flatMap((r) => r.slots.map((x) => x.sortOrder))).toEqual([0, 1, 2, 3])
  })

  it('accepts 24:00 as end of day', () => {
    const s = ok({ ranges: [{ date: '2027-03-10', start: '22:00', end: '24:00' }] })
    expect(s.ranges[0]!.endAt).toBe('2027-03-11T05:00:00Z')
    expect(s.ranges[0]!.slots).toHaveLength(4)
  })

  it('allows exactly 12 hours and rejects longer', () => {
    expect(ok({ ranges: [{ date: '2027-03-10', start: '08:00', end: '20:00' }] }).ranges[0]!.slots).toHaveLength(24)
    expect(issues({ ranges: [{ date: '2027-03-10', start: '08:00', end: '20:30' }] })).toEqual([{ code: 'range_too_long', date: '2027-03-10' }])
  })

  it('works in a zone without DST', () => {
    const s = ok({ timezone: 'Asia/Kolkata', ranges: [{ date: '2027-03-10', start: '09:00', end: '10:00' }] })
    expect(s.ranges[0]!.startAt).toBe('2027-03-10T03:30:00Z')
  })
})

describe('buildSchedule — time validation', () => {
  const on = (start: string, end: string) => issues({ ranges: [{ date: '2027-03-10', start, end }] })

  it('requires half-hour boundaries', () => {
    expect(on('18:15', '20:00')).toEqual([{ code: 'off_slot_boundary', date: '2027-03-10' }])
  })
  it('rejects end before or equal to start (no overnight ranges)', () => {
    expect(on('20:00', '20:00')[0]!.code).toBe('end_not_after_start')
    expect(on('22:00', '01:00')[0]!.code).toBe('end_not_after_start')
  })
  it('rejects malformed times', () => {
    expect(on('25:00', '26:00')[0]!.code).toBe('invalid_time')
    expect(on('7pm', '9pm')[0]!.code).toBe('invalid_time')
    expect(on('24:00', '24:00')[0]!.code).toBe('invalid_time')
  })
  it('rejects ranges shorter than the meeting', () => {
    expect(issues({ durationMinutes: 90, ranges: [{ date: '2027-03-10', start: '18:00', end: '19:00' }] })).toEqual([
      { code: 'shorter_than_duration', date: '2027-03-10' },
    ])
  })
  it('rejects unsupported durations', () => {
    expect(issues({ durationMinutes: 45, ranges: [{ date: '2027-03-10', start: '18:00', end: '20:00' }] })).toContainEqual({ code: 'invalid_duration' })
  })
})

describe('buildSchedule — daylight saving time', () => {
  // America/New_York 2027: spring forward Mar 14 02:00→03:00; fall back Nov 7 02:00→01:00.
  it('rejects a start time skipped by spring-forward', () => {
    expect(issues({ ranges: [{ date: '2027-03-14', start: '02:30', end: '04:00' }] })).toEqual([
      { code: 'nonexistent_time', date: '2027-03-14', time: '02:30' },
    ])
  })
  it('rejects an end time skipped by spring-forward', () => {
    expect(issues({ ranges: [{ date: '2027-03-14', start: '00:00', end: '02:00' }] })).toEqual([
      { code: 'nonexistent_time', date: '2027-03-14', time: '02:00' },
    ])
  })
  it('rejects a range spanning spring-forward', () => {
    expect(issues({ ranges: [{ date: '2027-03-14', start: '01:00', end: '04:00' }] })).toEqual([{ code: 'crosses_dst', date: '2027-03-14' }])
  })
  it('rejects an ambiguous fall-back time', () => {
    expect(issues({ ranges: [{ date: '2027-11-07', start: '01:30', end: '03:00' }] })).toEqual([
      { code: 'ambiguous_time', date: '2027-11-07', time: '01:30' },
    ])
  })
  it('rejects a range spanning fall-back', () => {
    expect(issues({ ranges: [{ date: '2027-11-07', start: '00:00', end: '03:00' }] })).toEqual([{ code: 'crosses_dst', date: '2027-11-07' }])
  })
  it('accepts ranges on transition days that avoid the change, using the new offset', () => {
    const spring = ok({ ranges: [{ date: '2027-03-14', start: '09:00', end: '17:00' }] })
    expect(spring.ranges[0]!.startAt).toBe('2027-03-14T13:00:00Z') // EDT = UTC-4
    expect(spring.ranges[0]!.slots).toHaveLength(16)
    const fall = ok({ ranges: [{ date: '2027-11-07', start: '02:00', end: '04:00' }] })
    expect(fall.ranges[0]!.startAt).toBe('2027-11-07T07:00:00Z') // EST = UTC-5
  })
  // Europe/London 2027: spring forward Mar 28 01:00→02:00; fall back Oct 31 02:00→01:00.
  it('handles Europe/London transitions', () => {
    const tz = 'Europe/London'
    expect(issues({ timezone: tz, ranges: [{ date: '2027-03-28', start: '01:00', end: '03:00' }] })).toEqual([
      { code: 'nonexistent_time', date: '2027-03-28', time: '01:00' },
    ])
    expect(issues({ timezone: tz, ranges: [{ date: '2027-03-28', start: '00:00', end: '03:00' }] })[0]!.code).toBe('crosses_dst')
    expect(issues({ timezone: tz, ranges: [{ date: '2027-10-31', start: '01:00', end: '02:00' }] })).toEqual([
      { code: 'ambiguous_time', date: '2027-10-31', time: '01:00' },
    ])
    expect(ok({ timezone: tz, ranges: [{ date: '2027-03-28', start: '10:00', end: '11:00' }] }).ranges[0]!.startAt).toBe('2027-03-28T09:00:00Z')
  })
})

describe('buildSchedule — date validation', () => {
  const r = (date: string) => ({ date, start: '18:00', end: '20:00' })

  it('requires 1 to 7 dates', () => {
    expect(issues({ ranges: [] })).toContainEqual({ code: 'no_dates' })
    const eight = Array.from({ length: 8 }, (_, i) => r(`2027-03-${String(i + 10).padStart(2, '0')}`))
    expect(issues({ ranges: eight })).toContainEqual({ code: 'too_many_dates' })
    expect(ok({ ranges: eight.slice(0, 7) }).ranges).toHaveLength(7)
  })
  it('rejects duplicates and invalid dates', () => {
    expect(issues({ ranges: [r('2027-03-10'), r('2027-03-10')] })).toEqual([{ code: 'duplicate_date', date: '2027-03-10' }])
    expect(issues({ ranges: [r('2027-02-30')] })).toEqual([{ code: 'invalid_date', date: '2027-02-30' }])
    expect(issues({ ranges: [r('03/10/2027')] })[0]!.code).toBe('invalid_date')
  })
  it('enforces a 30-day span', () => {
    expect(ok({ ranges: [r('2027-02-01'), r('2027-03-03')] }).ranges).toHaveLength(2)
    expect(issues({ ranges: [r('2027-02-01'), r('2027-03-04')] })).toContainEqual({ code: 'span_too_long' })
  })
  it('judges "past" in the event timezone, not UTC', () => {
    const now = Temporal.Instant.from('2027-01-01T03:00:00Z') // Dec 31 in New York, Jan 1 in Auckland
    const evening = { date: '2026-12-31', start: '21:00', end: '23:00' } // ends 04:00Z, after now
    expect(build({ timezone: 'America/New_York', ranges: [evening] }, now).ok).toBe(true)
    expect(issues({ timezone: 'Pacific/Auckland', ranges: [evening] }, now)).toEqual([{ code: 'date_in_past', date: '2026-12-31' }])
  })
  it('allows today, but not a range that has already ended', () => {
    // NOW = 07:00 in New York on 2027-01-01
    expect(build({ ranges: [{ date: '2027-01-01', start: '08:00', end: '10:00' }] }).ok).toBe(true)
    expect(issues({ ranges: [{ date: '2027-01-01', start: '05:00', end: '07:00' }] })).toEqual([{ code: 'range_already_ended', date: '2027-01-01' }])
  })
  it('validates the timezone as an IANA identifier', () => {
    for (const tz of ['Mars/Phobos', '+05:00', '']) {
      expect(issues({ timezone: tz, ranges: [r('2027-03-10')] })).toEqual([{ code: 'invalid_timezone' }])
    }
    expect(build({ timezone: 'UTC', ranges: [r('2027-03-10')] }).ok).toBe(true)
  })
  it('reports every problem at once', () => {
    const found = issues({ ranges: [r('2027-03-10'), { date: '2027-03-11', start: '18:15', end: '19:00' }, { date: '2027-03-14', start: '02:30', end: '04:00' }] })
    expect(found.map((i) => i.code)).toEqual(['off_slot_boundary', 'nonexistent_time'])
  })
})

describe('describeIssue', () => {
  it('explains DST problems in plain language with the date', () => {
    expect(describeIssue({ code: 'nonexistent_time', date: '2027-03-14', time: '02:30' })).toMatch(/02:30 doesn’t exist on Sun, Mar 14.*daylight saving/)
    expect(describeIssue({ code: 'ambiguous_time', date: '2027-11-07', time: '01:30' })).toMatch(/happens twice/)
    expect(describeIssue({ code: 'crosses_dst', date: '2027-03-14' })).toMatch(/Daylight saving time changes/)
  })
})
