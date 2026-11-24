import { describe, expect, it } from 'vitest'
import { makeSlots } from '../../domain/testkit'
import { buildSlotGrid, moveInGrid } from './grid'

describe('buildSlotGrid', () => {
  it('lays out dates as columns and clock times as rows, leaving cells empty where there is no slot', () => {
    // Day 1: 9:00–10:00 UTC (2 slots). Day 2: 9:30–10:30 UTC (2 slots).
    const slots = [...makeSlots('a', '2027-05-03T09:00:00Z', 2), ...makeSlots('b', '2027-05-04T09:30:00Z', 2)]
    const g = buildSlotGrid(slots, 'UTC')
    expect(g.columns.map((c) => c.date)).toEqual(['2027-05-03', '2027-05-04'])
    expect(g.rows.map((r) => r.label)).toEqual(['9:00 AM', '9:30 AM', '10:00 AM'])
    expect(g.cells.map((row) => row.map((c) => c?.id ?? null))).toEqual([
      ['a-0', null],
      ['a-1', 'b-0'],
      [null, 'b-1'],
    ])
  })

  it('marks gaps between non-adjacent times', () => {
    const slots = [...makeSlots('a', '2027-05-03T09:00:00Z', 1), ...makeSlots('b', '2027-05-03T13:00:00Z', 1)]
    const g = buildSlotGrid(slots, 'UTC')
    expect(g.rows.map((r) => r.gapBefore)).toEqual([false, true])
  })

  it('regroups by the display timezone: one event date can split across two local days', () => {
    // 22:00–01:00 UTC on May 3 → in Auckland (UTC+12) that is 10:00–13:00 on May 4; in LA (UTC-7) 15:00–18:00 May 3.
    const slots = makeSlots('a', '2027-05-03T22:00:00Z', 6)
    expect(buildSlotGrid(slots, 'Pacific/Auckland').columns.map((c) => c.date)).toEqual(['2027-05-04'])
    expect(buildSlotGrid(slots, 'UTC').columns.map((c) => c.date)).toEqual(['2027-05-03', '2027-05-04'])
  })

  it('gives a repeated wall-clock time (fall-back day) its own row instead of overwriting', () => {
    // New York falls back at 06:00Z on 2027-11-07: 05:00Z and 06:00Z are both 1:00 AM local.
    const slots = makeSlots('a', '2027-11-07T05:00:00Z', 4)
    const g = buildSlotGrid(slots, 'America/New_York')
    expect(g.positions.size).toBe(4)
    expect(g.rows).toHaveLength(4)
    expect(g.rows.map((r) => r.label)).toEqual(['1:00 AM', '1:00 AM (-05:00)', '1:30 AM', '1:30 AM (-05:00)'])
  })
})

describe('moveInGrid', () => {
  const slots = [...makeSlots('a', '2027-05-03T09:00:00Z', 3), ...makeSlots('b', '2027-05-04T10:00:00Z', 1), ...makeSlots('c', '2027-05-05T09:00:00Z', 1)]
  const g = buildSlotGrid(slots, 'UTC')
  // rows 9:00, 9:30, 10:00 · cols 3, 4, 5
  it('skips empty cells and stops at the edges', () => {
    expect(moveInGrid(g, [0, 0], 'right')).toEqual([0, 2])
    expect(moveInGrid(g, [0, 2], 'right')).toEqual([0, 2])
    expect(moveInGrid(g, [0, 0], 'up')).toEqual([0, 0])
    expect(moveInGrid(g, [2, 0], 'right')).toEqual([2, 1])
  })
  it('supports row start/end and first/last', () => {
    expect(moveInGrid(g, [0, 2], 'rowStart')).toEqual([0, 0])
    expect(moveInGrid(g, [2, 0], 'rowEnd')).toEqual([2, 1])
    expect(moveInGrid(g, [2, 1], 'first')).toEqual([0, 0])
    expect(moveInGrid(g, [0, 0], 'last')).toEqual([2, 1])
  })
})
