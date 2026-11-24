import { describe, expect, it } from 'vitest'
import { Temporal } from '../../domain/time.ts'
import { canAddRow, checkSchedule, defaultRows, nextRow, type DateRow } from './scheduleForm'

const now = Temporal.Instant.from('2027-05-03T12:00:00Z')
const row = (date: string, start = '09:00', end = '17:00'): DateRow => ({ key: date, date, start, end })

describe('creation form rows', () => {
  it('defaults to tomorrow in the event timezone, 9–5', () => {
    expect(defaultRows('UTC', now)).toMatchObject([{ date: '2027-05-04', start: '09:00', end: '17:00' }])
    // Already May 4 in Auckland at 12:00Z.
    expect(defaultRows('Pacific/Auckland', now)[0]!.date).toBe('2027-05-05')
  })

  it('adds the day after the latest date with the last row’s times', () => {
    expect(nextRow([row('2027-05-06'), row('2027-05-04', '13:00', '15:00')], 'UTC', now)).toMatchObject({ date: '2027-05-07', start: '13:00', end: '15:00' })
  })

  it('caps rows at 7', () => {
    expect(canAddRow(Array.from({ length: 6 }, (_, i) => row(`2027-05-1${i}`)))).toBe(true)
    expect(canAddRow(Array.from({ length: 7 }, (_, i) => row(`2027-05-1${i}`)))).toBe(false)
  })

  it('groups schedule issues by date and counts slots when valid', () => {
    const ok = checkSchedule([row('2027-05-04'), row('2027-05-05', '18:00', '20:00')], 'UTC', 60, now)
    expect(ok).toMatchObject({ ok: true, slotCount: 20 })

    const bad = checkSchedule([row('2027-05-04', '10:00', '09:00'), row('2027-05-01')], 'UTC', 60, now)
    expect(bad.ok).toBe(false)
    expect(bad.byDate.get('2027-05-04')?.[0]?.code).toBe('end_not_after_start')
    expect(bad.byDate.get('2027-05-01')?.[0]?.code).toBe('date_in_past')
  })
})
