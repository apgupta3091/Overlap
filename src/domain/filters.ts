import { monthlyCost } from './costs'
import { ARCHIVED_STATUSES, type ListingStatus, type ListingSummary, type Member, type VoteValue } from './types'
import { isEveryoneInterested, voteOf } from './votes'

export type StatusFilter = 'active' | 'all' | ListingStatus
export type MyVoteFilter = 'any' | 'unvoted' | VoteValue
export type SortKey = 'recent' | 'monthly_cost' | 'upcoming_tour'

export interface BoardFilters {
  search: string
  status: StatusFilter
  myVote: MyVoteFilter
  everyoneInterested: boolean
  sort: SortKey
}

export const DEFAULT_FILTERS: BoardFilters = {
  search: '',
  status: 'active',
  myVote: 'any',
  everyoneInterested: false,
  sort: 'recent',
}

export const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recently added',
  monthly_cost: 'Known monthly cost',
  upcoming_tour: 'Upcoming tour',
}

export function isArchived(status: ListingStatus): boolean {
  return ARCHIVED_STATUSES.includes(status)
}

export function hasUpcomingTour(listing: ListingSummary, now: Date): boolean {
  return listing.tour !== null && new Date(listing.tour.startsAt).getTime() >= now.getTime()
}

function matchesSearch(listing: ListingSummary, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return [listing.title, listing.address, listing.neighborhood].some((v) => v?.toLowerCase().includes(q))
}

function matchesStatus(listing: ListingSummary, status: StatusFilter): boolean {
  if (status === 'all') return true
  if (status === 'active') return !isArchived(listing.status)
  return listing.status === status
}

function byRecent(a: ListingSummary, b: ListingSummary): number {
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
}

export interface FilterContext {
  members: readonly Member[]
  currentUserId: string
  now: Date
}

/** Apply search, filters, and sort. Pure; safe to call on every render for ≤100 listings. */
export function applyBoardFilters(
  listings: readonly ListingSummary[],
  filters: BoardFilters,
  ctx: FilterContext,
): ListingSummary[] {
  const result = listings.filter((l) => {
    if (!matchesSearch(l, filters.search)) return false
    if (!matchesStatus(l, filters.status)) return false
    if (filters.myVote !== 'any') {
      const mine = voteOf(l.votes, ctx.currentUserId)
      if (filters.myVote === 'unvoted' ? mine !== null : mine !== filters.myVote) return false
    }
    if (filters.everyoneInterested && !isEveryoneInterested(l.votes, ctx.members)) return false
    return true
  })

  switch (filters.sort) {
    case 'recent':
      return result.sort(byRecent)
    case 'monthly_cost':
      return result.sort((a, b) => monthlyCost(a).totalCents - monthlyCost(b).totalCents || byRecent(a, b))
    case 'upcoming_tour':
      return result.sort((a, b) => {
        const aUp = hasUpcomingTour(a, ctx.now)
        const bUp = hasUpcomingTour(b, ctx.now)
        if (aUp && bUp) return a.tour!.startsAt.localeCompare(b.tour!.startsAt) || byRecent(a, b)
        if (aUp !== bUp) return aUp ? -1 : 1
        return byRecent(a, b)
      })
  }
}

/** Number of listings hidden only because they are rejected/unavailable. */
export function countHiddenArchived(listings: readonly ListingSummary[], filters: BoardFilters): number {
  if (filters.status !== 'active') return 0
  return listings.filter((l) => isArchived(l.status)).length
}

export function filtersAreDefault(filters: BoardFilters): boolean {
  return (
    filters.search.trim() === '' &&
    filters.status === DEFAULT_FILTERS.status &&
    filters.myVote === DEFAULT_FILTERS.myVote &&
    !filters.everyoneInterested
  )
}
