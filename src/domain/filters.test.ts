import { describe, expect, it } from 'vitest'
import { applyBoardFilters, countHiddenArchived, DEFAULT_FILTERS } from './filters'
import type { ListingSummary, Member } from './types'

const member = (userId: string): Member => ({ userId, displayName: userId, joinedAt: '', isOwner: false })
const members = [member('me'), member('roomie')]

function listing(id: string, over: Partial<ListingSummary> = {}): ListingSummary {
  return {
    id, boardId: 'b', createdBy: 'me', updatedBy: 'me', listingUrl: `https://e.com/${id}`, normalizedListingUrl: `e.com/${id}`,
    title: `Apt ${id}`, address: null, neighborhood: null, baseRentCents: 300000, parkingCents: null, petFeeCents: null,
    otherMonthlyFeesCents: null, utilitiesCents: null, securityDepositCents: null, oneTimeFeesCents: null, leaseMonths: null,
    freeMonths: null, bedrooms: null, bathrooms: null, squareFeet: null, laundry: 'unknown', pets: 'unknown',
    outdoorSpace: 'unknown', elevator: 'unknown', commuteMinutes: null, availableFrom: null, status: 'saved',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', images: [], votes: [], tour: null, ...over,
  }
}

const ctx = { members, currentUserId: 'me', now: new Date('2026-03-01T00:00:00Z') }

describe('applyBoardFilters', () => {
  it('sorts by recently added by default and hides rejected/unavailable', () => {
    const items = [
      listing('a', { createdAt: '2026-01-01T00:00:00Z' }),
      listing('b', { createdAt: '2026-01-03T00:00:00Z' }),
      listing('c', { createdAt: '2026-01-02T00:00:00Z', status: 'rejected' }),
    ]
    expect(applyBoardFilters(items, DEFAULT_FILTERS, ctx).map((l) => l.id)).toEqual(['b', 'a'])
    expect(countHiddenArchived(items, DEFAULT_FILTERS)).toBe(1)
    expect(applyBoardFilters(items, { ...DEFAULT_FILTERS, status: 'all' }, ctx)).toHaveLength(3)
  })

  it('searches title, address, and neighborhood', () => {
    const items = [listing('a', { neighborhood: 'Downtown Jersey City' }), listing('b', { address: '12 Garden St' })]
    expect(applyBoardFilters(items, { ...DEFAULT_FILTERS, search: 'garden' }, ctx).map((l) => l.id)).toEqual(['b'])
    expect(applyBoardFilters(items, { ...DEFAULT_FILTERS, search: 'jersey' }, ctx).map((l) => l.id)).toEqual(['a'])
  })

  it('filters by my vote, including unvoted', () => {
    const items = [
      listing('a', { votes: [{ listingId: 'a', userId: 'me', vote: 'maybe', updatedAt: '' }] }),
      listing('b'),
    ]
    expect(applyBoardFilters(items, { ...DEFAULT_FILTERS, myVote: 'maybe' }, ctx).map((l) => l.id)).toEqual(['a'])
    expect(applyBoardFilters(items, { ...DEFAULT_FILTERS, myVote: 'unvoted' }, ctx).map((l) => l.id)).toEqual(['b'])
  })

  it('everyone-interested excludes listings with unvoted members', () => {
    const yes = (listingId: string, userId: string) => ({ listingId, userId, vote: 'interested' as const, updatedAt: '' })
    const items = [listing('a', { votes: [yes('a', 'me'), yes('a', 'roomie')] }), listing('b', { votes: [yes('b', 'me')] })]
    expect(applyBoardFilters(items, { ...DEFAULT_FILTERS, everyoneInterested: true }, ctx).map((l) => l.id)).toEqual(['a'])
  })

  it('sorts by known monthly cost', () => {
    const items = [listing('a', { baseRentCents: 300000, parkingCents: 50000 }), listing('b', { baseRentCents: 320000 })]
    expect(applyBoardFilters(items, { ...DEFAULT_FILTERS, sort: 'monthly_cost' }, ctx).map((l) => l.id)).toEqual(['b', 'a'])
  })

  it('sorts upcoming tours first, soonest first, past tours after', () => {
    const tour = (listingId: string, startsAt: string) => ({ listingId, startsAt, timezone: 'UTC', note: null, createdBy: 'me', updatedAt: '' })
    const items = [
      listing('none', { createdAt: '2026-02-01T00:00:00Z' }),
      listing('past', { tour: tour('past', '2026-02-01T00:00:00Z') }),
      listing('later', { tour: tour('later', '2026-03-10T00:00:00Z') }),
      listing('soon', { tour: tour('soon', '2026-03-02T00:00:00Z') }),
    ]
    expect(applyBoardFilters(items, { ...DEFAULT_FILTERS, sort: 'upcoming_tour' }, ctx).map((l) => l.id).slice(0, 2)).toEqual([
      'soon',
      'later',
    ])
  })
})
