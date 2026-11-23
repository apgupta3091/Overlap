// Local-only repository for /demo. Never talks to the network.
// State persists to localStorage when available; otherwise it lives in memory for the session.
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
  VoteValue,
} from '../domain/types'
import { normalizeListingUrl } from '../domain/url'
import { appError, AppError } from '../data/errors'
import {
  LIMITS,
  type BoardExport,
  type BoardInput,
  type CreatedInvite,
  type ImageUrls,
  type ProcessedImage,
  type Repository,
  type TourInput,
} from '../data/repository'
import { createDemoSeed, DEMO_BOARD_ID, DEMO_USER_ID, type DemoState } from './fixtures'

export const DEMO_STATE_KEY = 'shortlist.demo.v1'
export const DEMO_IMAGES_KEY = 'shortlist.demo.images.v1'

export type DemoPersistence = 'device' | 'memory'

function safeStorage(): Storage | null {
  try {
    const s = window.localStorage
    const probe = '__shortlist_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)
}

function randomId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return `${prefix}-${uuid}`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

export class DemoRepository implements Repository {
  readonly mode = 'demo' as const
  private state: DemoState
  private imageData: Record<string, ImageUrls>
  private storage: Storage | null
  persistence: DemoPersistence

  constructor(options: { storage?: Storage | null; now?: () => Date } = {}) {
    this.now = options.now ?? (() => new Date())
    this.storage = options.storage === undefined ? safeStorage() : options.storage
    this.persistence = this.storage ? 'device' : 'memory'
    this.state = this.loadState()
    this.imageData = this.loadImages()
  }

  private now: () => Date

  private loadState(): DemoState {
    try {
      const raw = this.storage?.getItem(DEMO_STATE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DemoState
        if (parsed?.version === 1 && Array.isArray(parsed.listings)) return parsed
      }
    } catch {
      // Corrupt or unreadable data: fall back to a fresh seed.
    }
    return createDemoSeed(this.now())
  }

  private loadImages(): Record<string, ImageUrls> {
    try {
      const raw = this.storage?.getItem(DEMO_IMAGES_KEY)
      return raw ? (JSON.parse(raw) as Record<string, ImageUrls>) : {}
    } catch {
      return {}
    }
  }

  private write(key: string, value: unknown) {
    if (!this.storage) return
    try {
      this.storage.setItem(key, JSON.stringify(value))
    } catch (e) {
      if (isQuotaError(e)) throw appError('storage_full')
      // Storage became unavailable (e.g. privacy mode): keep working in memory.
      this.storage = null
      this.persistence = 'memory'
    }
  }

  /** Apply a mutation to a copy and persist it; state only changes if persistence succeeds. */
  private commit<T>(mutate: (draft: DemoState) => T): T {
    const draft = structuredClone(this.state)
    const result = mutate(draft)
    draft.board.updatedAt = this.now().toISOString()
    this.write(DEMO_STATE_KEY, draft)
    this.state = draft
    return result
  }

  reset(): void {
    this.state = createDemoSeed(this.now())
    this.imageData = {}
    try {
      this.storage?.removeItem(DEMO_STATE_KEY)
      this.storage?.removeItem(DEMO_IMAGES_KEY)
    } catch {
      // ignore
    }
  }

  private assertBoard(boardId: string) {
    if (boardId !== DEMO_BOARD_ID) throw appError('not_found')
  }

  private findListing(draft: DemoState, listingId: string): Listing {
    const listing = draft.listings.find((l) => l.id === listingId)
    if (!listing) throw appError('not_found', 'That apartment was deleted.')
    return listing
  }

  // ---- Boards --------------------------------------------------------------

  async listBoards(): Promise<BoardSummary[]> {
    const { board, listings, members } = this.state
    return [{ ...board, listingCount: listings.length, memberCount: members.length }]
  }

  async createBoard(_input: BoardInput): Promise<Board> {
    throw appError('forbidden', 'The demo has a single board. Create an account to make your own.')
  }

  async getBoard(boardId: string): Promise<BoardDetail> {
    this.assertBoard(boardId)
    return structuredClone({ board: this.state.board, members: this.state.members, currentUserId: DEMO_USER_ID })
  }

  async updateBoard(boardId: string, input: BoardInput): Promise<void> {
    this.assertBoard(boardId)
    this.commit((d) => {
      d.board.name = input.name
      d.board.locationLabel = input.locationLabel
      d.board.monthlyBudgetCents = input.monthlyBudgetCents
    })
  }

  async deleteBoard(): Promise<void> {
    throw appError('forbidden', 'The demo board can’t be deleted. Use “Reset demo” to start over.')
  }

  async exportBoard(boardId: string): Promise<BoardExport> {
    this.assertBoard(boardId)
    const s = this.state
    return {
      exportedAt: this.now().toISOString(),
      format: 'shortlist-board-export',
      version: 1,
      board: s.board,
      members: s.members.map(({ userId, displayName, isOwner, joinedAt }) => ({ userId, displayName, isOwner, joinedAt })),
      listings: s.listings.map((l) => ({
        ...l,
        images: s.images
          .filter((i) => i.listingId === l.id)
          .map((i) => ({ storagePath: i.storagePath, sortOrder: i.sortOrder })),
        votes: s.votes.filter((v) => v.listingId === l.id).map(({ userId, vote, updatedAt }) => ({ userId, vote, updatedAt })),
        tour: s.tours.find((t) => t.listingId === l.id) ?? null,
        notes: s.notes.filter((n) => n.listingId === l.id),
      })),
    }
  }

  // ---- Membership (demo is read-only here) ---------------------------------

  async removeMember(): Promise<void> {
    throw appError('forbidden', 'Demo roommates can’t be removed.')
  }
  async leaveBoard(): Promise<void> {
    throw appError('forbidden', 'You own the demo board.')
  }
  async listInvites(): Promise<Invite[]> {
    return []
  }
  async createInvite(): Promise<CreatedInvite> {
    throw appError('forbidden', 'The demo doesn’t create real invitations. Create an account to invite your roommates.')
  }
  async revokeInvite(): Promise<void> {
    throw appError('forbidden')
  }
  async getInviteStatus(): Promise<InviteStatus> {
    return { state: 'invalid' }
  }
  async acceptInvite(): Promise<{ boardId: string; alreadyMember: boolean }> {
    throw appError('forbidden')
  }

  // ---- Listings ------------------------------------------------------------

  async listListings(boardId: string): Promise<ListingSummary[]> {
    this.assertBoard(boardId)
    const s = this.state
    return structuredClone(
      s.listings.map((l) => ({
        ...l,
        images: s.images.filter((i) => i.listingId === l.id).sort((a, b) => a.sortOrder - b.sortOrder),
        votes: s.votes.filter((v) => v.listingId === l.id),
        tour: s.tours.find((t) => t.listingId === l.id) ?? null,
      })),
    )
  }

  async createListing(boardId: string, fields: ListingFields, initialNote: string | null): Promise<Listing> {
    this.assertBoard(boardId)
    return this.commit((d) => {
      if (d.listings.length >= LIMITS.listingsPerBoard) {
        throw appError('limit_reached', `A board can hold up to ${LIMITS.listingsPerBoard} listings.`)
      }
      const now = this.now().toISOString()
      const listing: Listing = {
        ...fields,
        id: randomId('listing'),
        boardId,
        createdBy: DEMO_USER_ID,
        updatedBy: DEMO_USER_ID,
        normalizedListingUrl: normalizeListingUrl(fields.listingUrl),
        status: 'saved',
        createdAt: now,
        updatedAt: now,
      }
      d.listings.push(listing)
      if (initialNote) {
        d.notes.push({
          id: randomId('note'),
          listingId: listing.id,
          authorId: DEMO_USER_ID,
          authorName: 'You',
          body: initialNote,
          createdAt: now,
          editedAt: null,
        })
      }
      return listing
    })
  }

  async updateListing(boardId: string, listingId: string, fields: ListingFields): Promise<void> {
    this.assertBoard(boardId)
    this.commit((d) => {
      const l = this.findListing(d, listingId)
      Object.assign(l, fields, {
        normalizedListingUrl: normalizeListingUrl(fields.listingUrl),
        updatedBy: DEMO_USER_ID,
        updatedAt: this.now().toISOString(),
      })
    })
  }

  async deleteListing(boardId: string, listingId: string): Promise<void> {
    this.assertBoard(boardId)
    const removedImages = this.state.images.filter((i) => i.listingId === listingId)
    this.commit((d) => {
      const l = this.findListing(d, listingId)
      if (l.createdBy !== DEMO_USER_ID && d.board.ownerId !== DEMO_USER_ID) throw appError('forbidden')
      d.listings = d.listings.filter((x) => x.id !== listingId)
      d.images = d.images.filter((x) => x.listingId !== listingId)
      d.votes = d.votes.filter((x) => x.listingId !== listingId)
      d.notes = d.notes.filter((x) => x.listingId !== listingId)
      d.tours = d.tours.filter((x) => x.listingId !== listingId)
    })
    // Clean up locally stored photo data (the demo equivalent of storage-object cleanup).
    if (removedImages.some((i) => this.imageData[i.id])) {
      for (const i of removedImages) delete this.imageData[i.id]
      this.write(DEMO_IMAGES_KEY, this.imageData)
    }
  }

  async setStatus(boardId: string, listingId: string, status: ListingStatus): Promise<void> {
    this.assertBoard(boardId)
    this.commit((d) => {
      const l = this.findListing(d, listingId)
      l.status = status
      l.updatedBy = DEMO_USER_ID
      l.updatedAt = this.now().toISOString()
    })
  }

  async setVote(boardId: string, listingId: string, vote: VoteValue | null): Promise<void> {
    this.assertBoard(boardId)
    this.commit((d) => {
      this.findListing(d, listingId)
      d.votes = d.votes.filter((v) => !(v.listingId === listingId && v.userId === DEMO_USER_ID))
      if (vote) d.votes.push({ listingId, userId: DEMO_USER_ID, vote, updatedAt: this.now().toISOString() })
    })
  }

  // ---- Tours & notes -------------------------------------------------------

  async setTour(boardId: string, listingId: string, tour: TourInput): Promise<void> {
    this.assertBoard(boardId)
    this.commit((d) => {
      this.findListing(d, listingId)
      d.tours = d.tours.filter((t) => t.listingId !== listingId)
      d.tours.push({ listingId, ...tour, createdBy: DEMO_USER_ID, updatedAt: this.now().toISOString() })
    })
  }

  async clearTour(boardId: string, listingId: string): Promise<void> {
    this.assertBoard(boardId)
    this.commit((d) => {
      d.tours = d.tours.filter((t) => t.listingId !== listingId)
    })
  }

  async listNotes(boardId: string, listingId: string): Promise<Note[]> {
    this.assertBoard(boardId)
    return structuredClone(
      this.state.notes.filter((n) => n.listingId === listingId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    )
  }

  async addNote(boardId: string, listingId: string, body: string): Promise<void> {
    this.assertBoard(boardId)
    this.commit((d) => {
      this.findListing(d, listingId)
      d.notes.push({
        id: randomId('note'),
        listingId,
        authorId: DEMO_USER_ID,
        authorName: 'You',
        body,
        createdAt: this.now().toISOString(),
        editedAt: null,
      })
    })
  }

  async updateNote(boardId: string, noteId: string, body: string): Promise<void> {
    this.assertBoard(boardId)
    this.commit((d) => {
      const n = d.notes.find((x) => x.id === noteId)
      if (!n) throw appError('not_found', 'That note was deleted.')
      if (n.authorId !== DEMO_USER_ID) throw appError('forbidden', 'You can only edit your own notes.')
      n.body = body
      n.editedAt = this.now().toISOString()
    })
  }

  async deleteNote(boardId: string, noteId: string): Promise<void> {
    this.assertBoard(boardId)
    this.commit((d) => {
      const n = d.notes.find((x) => x.id === noteId)
      if (!n) return
      if (n.authorId !== DEMO_USER_ID) throw appError('forbidden', 'You can only delete your own notes.')
      d.notes = d.notes.filter((x) => x.id !== noteId)
    })
  }

  // ---- Images --------------------------------------------------------------

  async uploadImage(
    boardId: string,
    listingId: string,
    image: ProcessedImage,
    onProgress?: (fraction: number) => void,
  ): Promise<ListingImage> {
    this.assertBoard(boardId)
    const existing = this.state.images.filter((i) => i.listingId === listingId)
    if (existing.length >= LIMITS.imagesPerListing) {
      throw appError('limit_reached', `Each apartment can have up to ${LIMITS.imagesPerListing} photos.`)
    }
    onProgress?.(0.2)
    const [full, thumb] = await Promise.all([blobToDataUrl(image.full), blobToDataUrl(image.thumb)])
    onProgress?.(0.7)
    const id = randomId('img')
    const nextImages = { ...this.imageData, [id]: { full, thumb } }
    try {
      this.write(DEMO_IMAGES_KEY, nextImages)
    } catch (e) {
      if (e instanceof AppError && e.code === 'storage_full') {
        throw appError(
          'storage_full',
          'Demo photos are kept in this browser, and its storage is full. Try a smaller photo or reset the demo.',
        )
      }
      throw e
    }
    this.imageData = nextImages
    const record: ListingImage = {
      id,
      listingId,
      storagePath: `local:${id}`,
      thumbPath: `local:${id}`,
      sortOrder: existing.length ? Math.max(...existing.map((i) => i.sortOrder)) + 1 : 0,
      createdAt: this.now().toISOString(),
    }
    this.commit((d) => {
      this.findListing(d, listingId)
      d.images.push(record)
    })
    onProgress?.(1)
    return record
  }

  async deleteImage(boardId: string, image: ListingImage): Promise<void> {
    this.assertBoard(boardId)
    this.commit((d) => {
      d.images = d.images.filter((i) => i.id !== image.id)
    })
    if (this.imageData[image.id]) {
      delete this.imageData[image.id]
      this.write(DEMO_IMAGES_KEY, this.imageData)
    }
  }

  async getImageUrls(_boardId: string, images: ListingImage[]): Promise<Record<string, ImageUrls>> {
    const urls: Record<string, ImageUrls> = {}
    for (const img of images) {
      if (img.storagePath.startsWith('bundled:')) {
        const path = img.storagePath.slice('bundled:'.length)
        urls[img.id] = { full: path, thumb: img.thumbPath.slice('bundled:'.length) }
      } else if (this.imageData[img.id]) {
        urls[img.id] = this.imageData[img.id]!
      }
    }
    return urls
  }
}
