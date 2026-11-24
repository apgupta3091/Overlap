import { describe, expect, it } from 'vitest'
import { describeAttendance, describeResponseCount, displayLabels, heatLevel, tallySlots } from './results'
import { makeResponse as R, makeSlots, mark } from './testkit'

const slots = makeSlots('t', '2027-03-10T18:00:00Z', 2)

describe('tallySlots', () => {
  it('counts preferred within available and groups people by state', () => {
    const t = tallySlots(slots, [
      R('a', mark(['t-0'])),
      R('p', mark(['t-0'], 'preferred')),
      R('u', mark(['t-1'])),
      R('n', mark(['t-0']), { noneWork: true }),
    ]).get('t-0')!
    expect(t.availableCount).toBe(2)
    expect(t.preferredCount).toBe(1)
    expect(t.availableOnlyIds).toEqual(['a'])
    expect(t.preferredIds).toEqual(['p'])
    expect(t.unavailableIds).toEqual(['u', 'n'])
  })
})

describe('heatLevel', () => {
  it('scales with the share available; zero is distinct; full is the max', () => {
    expect(heatLevel(0, 4)).toBe(0)
    expect(heatLevel(1, 50)).toBe(1)
    expect(heatLevel(2, 4)).toBe(3)
    expect(heatLevel(4, 4)).toBe(5)
    expect(heatLevel(0, 0)).toBe(0)
  })
})

describe('wording', () => {
  it('only says "All" when it is actually everyone', () => {
    expect(describeAttendance(5, 6)).toBe('5 of 6 respondents available')
    expect(describeAttendance(6, 6)).toBe('All 6 respondents available')
    expect(describeAttendance(1, 1)).toBe('The 1 respondent is available')
  })
  it('reports expected counts as information, and actual counts when exceeded', () => {
    expect(describeResponseCount(4, null)).toBe('4 responses')
    expect(describeResponseCount(1, null)).toBe('1 response')
    expect(describeResponseCount(4, 6)).toBe('4 of 6 expected participants have responded')
    expect(describeResponseCount(7, 6)).toBe('7 responses')
  })
})

describe('displayLabels', () => {
  it('distinguishes duplicate names by submission order without changing unique ones', () => {
    const labels = displayLabels([
      R('2', {}, { name: 'Sam', createdAt: '2027-01-02T00:00:00Z' }),
      R('1', {}, { name: 'Sam', createdAt: '2027-01-01T00:00:00Z' }),
      R('3', {}, { name: 'sam ', createdAt: '2027-01-03T00:00:00Z' }),
      R('4', {}, { name: 'Ana' }),
    ])
    expect(labels.get('1')).toBe('Sam')
    expect(labels.get('2')).toBe('Sam (2)')
    expect(labels.get('3')).toBe('sam  (3)')
    expect(labels.get('4')).toBe('Ana')
  })
})
