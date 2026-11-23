import { describe, expect, it } from 'vitest'
import type { Member, Vote } from './types'
import { isEveryoneInterested, nextVote, summarizeVotes } from './votes'

const m = (userId: string): Member => ({ userId, displayName: userId, joinedAt: '2026-01-01', isOwner: userId === 'a' })
const v = (userId: string, vote: Vote['vote']): Vote => ({ listingId: 'l1', userId, vote, updatedAt: '2026-01-02' })

describe('isEveryoneInterested', () => {
  const members = [m('a'), m('b'), m('c')]
  it('is true only when every current member voted Interested', () => {
    expect(isEveryoneInterested([v('a', 'interested'), v('b', 'interested'), v('c', 'interested')], members)).toBe(true)
  })
  it('treats an unvoted member as not agreeing', () => {
    expect(isEveryoneInterested([v('a', 'interested'), v('b', 'interested')], members)).toBe(false)
  })
  it('is false when anyone voted Maybe or Pass', () => {
    expect(isEveryoneInterested([v('a', 'interested'), v('b', 'maybe'), v('c', 'interested')], members)).toBe(false)
  })
  it('ignores votes from people who left the board', () => {
    const votes = [v('a', 'interested'), v('b', 'interested'), v('departed', 'pass')]
    expect(isEveryoneInterested(votes, [m('a'), m('b')])).toBe(true)
  })
  it('is false for a board with no members', () => {
    expect(isEveryoneInterested([], [])).toBe(false)
  })
})

describe('summarizeVotes', () => {
  it('counts only current members and lists unvoted members', () => {
    const s = summarizeVotes([v('a', 'interested'), v('departed', 'interested'), v('b', 'pass')], [m('a'), m('b'), m('c')])
    expect(s.counts).toEqual({ interested: 1, maybe: 0, pass: 1 })
    expect(s.unvoted.map((x) => x.userId)).toEqual(['c'])
    expect(s.byMember.map((x) => x.vote)).toEqual(['interested', 'pass', null])
  })
})

describe('nextVote', () => {
  it('clears when clicking the active vote', () => {
    expect(nextVote('maybe', 'maybe')).toBeNull()
    expect(nextVote('maybe', 'pass')).toBe('pass')
    expect(nextVote(null, 'interested')).toBe('interested')
  })
})
