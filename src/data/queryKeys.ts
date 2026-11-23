import type { RepoMode } from './repository'

/** Query keys are scoped by mode (demo/live) and by board, so a board's data can be invalidated as a subtree. */
export const qk = {
  boards: (m: RepoMode) => [m, 'boards'] as const,
  board: (m: RepoMode, boardId: string) => [m, 'board', boardId] as const,
  boardDetail: (m: RepoMode, boardId: string) => [m, 'board', boardId, 'detail'] as const,
  listings: (m: RepoMode, boardId: string) => [m, 'board', boardId, 'listings'] as const,
  notes: (m: RepoMode, boardId: string, listingId: string) => [m, 'board', boardId, 'listing', listingId, 'notes'] as const,
  images: (m: RepoMode, boardId: string, imageIds: string) => [m, 'board', boardId, 'images', imageIds] as const,
  invites: (m: RepoMode, boardId: string) => [m, 'board', boardId, 'invites'] as const,
  inviteStatus: (m: RepoMode, token: string) => [m, 'invite', token] as const,
}

/** Shared-data refresh interval while the tab is visible (TanStack Query pauses in background tabs). */
export const REFRESH_INTERVAL_MS = 30_000

export function refreshInterval(mode: RepoMode): number | false {
  return mode === 'live' ? REFRESH_INTERVAL_MS : false
}
