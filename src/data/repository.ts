// The thin data seam shared by demo (local) and live (Supabase) modes.
// UI code talks only to hooks in ./hooks, which call this interface.
import type {
  Board,
  BoardDetail,
  BoardSummary,
  Invite,
  InviteStatus,
  Listing,
  ListingFields,
  ListingImage,
  ListingStatus,
  ListingSummary,
  Note,
  Tour,
  VoteValue,
} from '../domain/types'

export type RepoMode = 'demo' | 'live'

export interface BoardInput {
  name: string
  locationLabel: string | null
  monthlyBudgetCents: number | null
}

export interface TourInput {
  startsAt: string
  timezone: string
  note: string | null
}

export interface ProcessedImage {
  full: Blob
  thumb: Blob
  mimeType: 'image/webp' | 'image/jpeg'
}

export interface ImageUrls {
  full: string
  thumb: string
}

export interface CreatedInvite {
  invite: Invite
  /** Raw token — shown once to the owner, never stored client-side or logged. */
  token: string
}

export interface BoardExport {
  exportedAt: string
  format: 'shortlist-board-export'
  version: 1
  board: Board
  members: { userId: string; displayName: string; isOwner: boolean; joinedAt: string }[]
  listings: (Listing & {
    images: { storagePath: string; sortOrder: number }[]
    votes: { userId: string; vote: VoteValue; updatedAt: string }[]
    tour: Tour | null
    notes: Note[]
  })[]
}

export interface Repository {
  readonly mode: RepoMode

  // Boards
  listBoards(): Promise<BoardSummary[]>
  createBoard(input: BoardInput): Promise<Board>
  getBoard(boardId: string): Promise<BoardDetail>
  updateBoard(boardId: string, input: BoardInput): Promise<void>
  deleteBoard(boardId: string): Promise<void>
  exportBoard(boardId: string): Promise<BoardExport>

  // Membership & invites
  removeMember(boardId: string, userId: string): Promise<void>
  leaveBoard(boardId: string): Promise<void>
  listInvites(boardId: string): Promise<Invite[]>
  createInvite(boardId: string): Promise<CreatedInvite>
  revokeInvite(boardId: string, inviteId: string): Promise<void>
  getInviteStatus(token: string): Promise<InviteStatus>
  acceptInvite(token: string): Promise<{ boardId: string; alreadyMember: boolean }>

  // Listings
  listListings(boardId: string): Promise<ListingSummary[]>
  createListing(boardId: string, fields: ListingFields, initialNote: string | null): Promise<Listing>
  updateListing(boardId: string, listingId: string, fields: ListingFields): Promise<void>
  deleteListing(boardId: string, listingId: string): Promise<void>
  setStatus(boardId: string, listingId: string, status: ListingStatus): Promise<void>
  setVote(boardId: string, listingId: string, vote: VoteValue | null): Promise<void>

  // Tours & notes
  setTour(boardId: string, listingId: string, tour: TourInput): Promise<void>
  clearTour(boardId: string, listingId: string): Promise<void>
  listNotes(boardId: string, listingId: string): Promise<Note[]>
  addNote(boardId: string, listingId: string, body: string): Promise<void>
  updateNote(boardId: string, noteId: string, body: string): Promise<void>
  deleteNote(boardId: string, noteId: string): Promise<void>

  // Images
  uploadImage(
    boardId: string,
    listingId: string,
    image: ProcessedImage,
    onProgress?: (fraction: number) => void,
  ): Promise<ListingImage>
  deleteImage(boardId: string, image: ListingImage): Promise<void>
  /** Resolve display URLs for images. Live mode returns short-lived signed URLs. */
  getImageUrls(boardId: string, images: ListingImage[]): Promise<Record<string, ImageUrls>>
}

export const LIMITS = {
  listingsPerBoard: 100,
  membersPerBoard: 10,
  imagesPerListing: 3,
  originalImageBytes: 10 * 1024 * 1024,
  uploadedImageBytes: 2 * 1024 * 1024,
  inviteExpiryDays: 7,
} as const
