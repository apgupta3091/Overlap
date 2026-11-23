// Core domain types shared by demo and Supabase-backed modes.
// Monetary amounts are always integer cents. `null` means "unknown" — never 0.

export const LISTING_STATUSES = [
  'saved',
  'shortlisted',
  'tour_scheduled',
  'applied',
  'rejected',
  'unavailable',
] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const STATUS_LABELS: Record<ListingStatus, string> = {
  saved: 'Saved',
  shortlisted: 'Shortlisted',
  tour_scheduled: 'Tour scheduled',
  applied: 'Applied',
  rejected: 'Rejected',
  unavailable: 'Unavailable',
}

/** Statuses hidden from the board by default. */
export const ARCHIVED_STATUSES: readonly ListingStatus[] = ['rejected', 'unavailable']

export const VOTE_VALUES = ['interested', 'maybe', 'pass'] as const
export type VoteValue = (typeof VOTE_VALUES)[number]

export const VOTE_LABELS: Record<VoteValue, string> = {
  interested: 'Interested',
  maybe: 'Maybe',
  pass: 'Pass',
}

export const LAUNDRY_VALUES = ['in_unit', 'in_building', 'none', 'unknown'] as const
export type Laundry = (typeof LAUNDRY_VALUES)[number]
export const LAUNDRY_LABELS: Record<Laundry, string> = {
  in_unit: 'In unit',
  in_building: 'In building',
  none: 'None',
  unknown: 'Unknown',
}

export const PET_VALUES = ['allowed', 'not_allowed', 'unknown'] as const
export type PetPolicy = (typeof PET_VALUES)[number]
export const PET_LABELS: Record<PetPolicy, string> = {
  allowed: 'Allowed',
  not_allowed: 'Not allowed',
  unknown: 'Unknown',
}

export const TRI_STATE_VALUES = ['yes', 'no', 'unknown'] as const
export type TriState = (typeof TRI_STATE_VALUES)[number]
export const TRI_STATE_LABELS: Record<TriState, string> = {
  yes: 'Yes',
  no: 'No',
  unknown: 'Unknown',
}

export interface Board {
  id: string
  name: string
  locationLabel: string | null
  monthlyBudgetCents: number | null
  currency: 'USD'
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface BoardSummary extends Board {
  listingCount: number
  memberCount: number
}

export interface Member {
  userId: string
  displayName: string
  joinedAt: string
  isOwner: boolean
}

/** Board plus its current members and the viewer's identity. */
export interface BoardDetail {
  board: Board
  members: Member[]
  currentUserId: string
}

/** Fields a user can enter for a listing (shared by create and edit). */
export interface ListingFields {
  listingUrl: string
  title: string | null
  address: string | null
  neighborhood: string | null
  baseRentCents: number
  parkingCents: number | null
  petFeeCents: number | null
  otherMonthlyFeesCents: number | null
  utilitiesCents: number | null
  securityDepositCents: number | null
  oneTimeFeesCents: number | null
  leaseMonths: number | null
  freeMonths: number | null
  bedrooms: number | null
  bathrooms: number | null
  squareFeet: number | null
  laundry: Laundry
  pets: PetPolicy
  outdoorSpace: TriState
  elevator: TriState
  commuteMinutes: number | null
  /** ISO date (YYYY-MM-DD) */
  availableFrom: string | null
}

export interface Listing extends ListingFields {
  id: string
  boardId: string
  createdBy: string
  updatedBy: string
  normalizedListingUrl: string
  status: ListingStatus
  createdAt: string
  updatedAt: string
}

export interface ListingImage {
  id: string
  listingId: string
  storagePath: string
  thumbPath: string
  sortOrder: number
  createdAt: string
}

export interface Vote {
  listingId: string
  userId: string
  vote: VoteValue
  updatedAt: string
}

export interface Tour {
  listingId: string
  /** ISO timestamp in UTC */
  startsAt: string
  /** IANA timezone the tour was entered in, e.g. America/New_York */
  timezone: string
  note: string | null
  createdBy: string
  updatedAt: string
}

export interface Note {
  id: string
  listingId: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
  /** null when never edited */
  editedAt: string | null
}

/** Compact listing data used by board cards, filters, and comparison. */
export interface ListingSummary extends Listing {
  images: ListingImage[]
  votes: Vote[]
  tour: Tour | null
}

export interface Invite {
  id: string
  boardId: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
}

export type InviteStatus =
  | { state: 'valid'; boardId: string; boardName: string; expiresAt: string }
  | { state: 'already_member'; boardId: string; boardName: string }
  | { state: 'expired' }
  | { state: 'revoked' }
  | { state: 'invalid' }
  | { state: 'board_full' }
