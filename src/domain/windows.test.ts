import { describe, expect, it } from 'vitest'
import { makeResponse as R, makeSlots, mark } from './testkit'
import { enumerateWindows, findWindow, rankWindows, scoreWindow, suggestWindows } from './windows'

// Range a: 18:00–21:00Z (6 slots a-0..a-5). Range b: next day 18:00–20:00Z (4 slots).
const a = makeSlots('a', '2027-03-10T18:00:00Z', 6)
const b = makeSlots('b', '2027-03-11T18:00:00Z', 4)
const slots = [...a, ...b]

describe('enumerateWindows', () => {
  it('produces every contiguous meeting-length run inside each range', () => {
    const w60 = enumerateWindows(slots, 60)
    expect(w60).toHaveLength(5 + 3)
    expect(w60[0]).toMatchObject({ rangeId: 'a', slotIds: ['a-0', 'a-1'], startAt: '2027-03-10T18:00:00Z', endAt: '2027-03-10T19:00:00Z' })
    expect(enumerateWindows(slots, 30)).toHaveLength(10)
    expect(enumerateWindows(slots, 120)).toHaveLength(3 + 1)
  })

  it('never crosses from one range into another, even when they touch in time', () => {
    const first = makeSlots('x', '2027-03-10T08:00:00Z', 2) // 08:00–09:00
    const second = makeSlots('y', '2027-03-10T09:00:00Z', 2) // 09:00–10:00
    const w = enumerateWindows([...first, ...second], 60)
    expect(w.map((x) => x.slotIds)).toEqual([
      ['x-0', 'x-1'],
      ['y-0', 'y-1'],
    ])
  })

  it('skips runs with a timestamp gap', () => {
    const gappy = [...makeSlots('g', '2027-03-10T08:00:00Z', 1), ...makeSlots('g', '2027-03-10T09:00:00Z', 1)]
    expect(enumerateWindows(gappy, 60)).toEqual([])
  })

  it('returns nothing when the range is shorter than the meeting', () => {
    expect(enumerateWindows(makeSlots('s', '2027-03-10T08:00:00Z', 3), 120)).toEqual([])
  })
})

describe('scoreWindow', () => {
  const window = enumerateWindows(a, 60)[0]! // a-0, a-1

  it('requires availability for the whole window', () => {
    const s = scoreWindow(window, [R('full', mark(['a-0', 'a-1'])), R('half', mark(['a-0']))])
    expect(s.availableIds).toEqual(['full'])
    expect(s.unavailableIds).toEqual(['half'])
  })

  it('treats preferred as available, and prefers a window only if every slot is preferred', () => {
    const s = scoreWindow(window, [
      R('pp', mark(['a-0', 'a-1'], 'preferred')),
      R('pa', { 'a-0': 'preferred', 'a-1': 'available' }),
    ])
    expect(s.availableIds).toEqual(['pp', 'pa'])
    expect(s.preferredIds).toEqual(['pp'])
  })

  it('counts "none of these times work" as unavailable, ignoring any stray slots', () => {
    const s = scoreWindow(window, [R('none', mark(['a-0', 'a-1']), { noneWork: true })])
    expect(s.availableIds).toEqual([])
    expect(s.unavailableIds).toEqual(['none'])
  })
})

describe('ranking and suggestions', () => {
  it('ranks by attendees, then preferrers, then earliest start — deterministically', () => {
    const responses = [
      R('p1', { ...mark(['a-2', 'a-3']), ...mark(['b-0', 'b-1'], 'preferred') }),
      R('p2', { ...mark(['a-2', 'a-3']), ...mark(['b-0', 'b-1']) }),
    ]
    const ranked = rankWindows(enumerateWindows(slots, 60), responses)
    // Both a-2/a-3 and b-0/b-1 have 2 attendees; b has a preferrer so it wins despite starting later.
    expect(ranked[0]!.slotIds).toEqual(['b-0', 'b-1'])
    expect(ranked[1]!.slotIds).toEqual(['a-2', 'a-3'])
    // Same input in another order → same ranking.
    const shuffled = rankWindows([...enumerateWindows(slots, 60)].reverse(), [...responses].reverse())
    expect(shuffled.map((w) => w.startAt)).toEqual(ranked.map((w) => w.startAt))
  })

  it('breaks full ties by earliest UTC start', () => {
    const everyone = R('x', mark(slots.map((s) => s.id)))
    const ranked = rankWindows(enumerateWindows(slots, 60), [everyone])
    expect(ranked.map((w) => w.startAt)).toEqual([...ranked.map((w) => w.startAt)].sort())
  })

  it('picks up to three non-overlapping suggestions', () => {
    const everyone = R('x', mark(slots.map((s) => s.id)))
    const picks = suggestWindows(slots, [everyone], 60)
    expect(picks.map((w) => w.slotIds)).toEqual([
      ['a-0', 'a-1'],
      ['a-2', 'a-3'],
      ['a-4', 'a-5'],
    ])
  })

  it('returns fewer than three when no further non-overlapping window exists', () => {
    const r = makeSlots('r', '2027-03-10T08:00:00Z', 3) // 90 minutes; 60-min windows all overlap
    const picks = suggestWindows(r, [R('x', mark(r.map((s) => s.id)))], 60)
    expect(picks).toHaveLength(1)
    expect(picks[0]!.slotIds).toEqual(['r-0', 'r-1'])
  })

  it('prefers a lower-ranked window that does not overlap over an overlapping better one', () => {
    const responses = [R('p1', mark(['a-0', 'a-1', 'a-2'])), R('p2', mark(['a-0', 'a-1', 'a-2'])), R('p3', mark(['b-2', 'b-3']))]
    const picks = suggestWindows(slots, responses, 60)
    expect(picks.map((w) => [w.slotIds.join('+'), w.availableIds.length])).toEqual([
      ['a-0+a-1', 2],
      ['b-2+b-3', 1],
    ])
  })

  it('never suggests a window nobody can attend', () => {
    // Each person is free for only one 30-minute slot, so no 60-minute window works for anyone.
    const responses = [R('p1', mark(['a-0'])), R('p2', mark(['a-3']))]
    expect(suggestWindows(slots, responses, 60)).toEqual([])
  })

  it('returns nothing before any responses, or when everyone says none work', () => {
    expect(suggestWindows(slots, [], 60)).toEqual([])
    expect(suggestWindows(slots, [R('n1', {}, { noneWork: true }), R('n2', {}, { noneWork: true })], 60)).toEqual([])
  })
})

describe('findWindow', () => {
  it('accepts any full meeting-length window and rejects partial or misaligned ones', () => {
    expect(findWindow(slots, '2027-03-10T18:30:00Z', 60)?.slotIds).toEqual(['a-1', 'a-2'])
    expect(findWindow(slots, '2027-03-10T20:30:00Z', 60)).toBeNull() // would run past the range end
    expect(findWindow(slots, '2027-03-10T18:15:00Z', 60)).toBeNull()
    expect(findWindow(slots, '2027-03-12T18:00:00Z', 60)).toBeNull()
  })
})
