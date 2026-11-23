import { describe, expect, it } from 'vitest'
import { parseCompareIds, toggleCompareSelection } from './compare'

describe('toggleCompareSelection', () => {
  it('adds up to three and refuses a fourth', () => {
    let s: string[] = []
    for (const id of ['a', 'b', 'c']) s = toggleCompareSelection(s, id).selected
    const r = toggleCompareSelection(s, 'd')
    expect(r.limitReached).toBe(true)
    expect(r.selected).toEqual(['a', 'b', 'c'])
  })
  it('removes a selected item even at the limit', () => {
    expect(toggleCompareSelection(['a', 'b', 'c'], 'b')).toEqual({ selected: ['a', 'c'], limitReached: false })
  })
})

describe('parseCompareIds', () => {
  it('dedupes, drops malformed ids, and caps at three', () => {
    expect(parseCompareIds('a,a,<script>,b,c,d')).toEqual(['a', 'b', 'c'])
    expect(parseCompareIds(null)).toEqual([])
  })
})
