import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { ListingFields, ListingStatus, ListingSummary, VoteValue } from '../../domain/types'
import { useRepo } from '../RepoContext'
import { qk, refreshInterval } from '../queryKeys'
import type { RepoMode, TourInput } from '../repository'
import { track } from '../../lib/analytics'

/** Compact listing dataset for a board (cards, filters, comparison). Notes are fetched separately. */
export function useListings(boardId: string) {
  const repo = useRepo()
  return useQuery({
    queryKey: qk.listings(repo.mode, boardId),
    queryFn: () => repo.listListings(boardId),
    refetchInterval: refreshInterval(repo.mode),
  })
}

/** One listing, selected from the board's compact dataset (shares cache + polling with the board). */
export function useListing(boardId: string, listingId: string) {
  const repo = useRepo()
  return useQuery({
    queryKey: qk.listings(repo.mode, boardId),
    queryFn: () => repo.listListings(boardId),
    refetchInterval: refreshInterval(repo.mode),
    select: (listings) => listings.find((l) => l.id === listingId) ?? null,
  })
}

function invalidateBoard(qc: QueryClient, mode: RepoMode, boardId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.listings(mode, boardId) }),
    qc.invalidateQueries({ queryKey: qk.boards(mode) }),
  ])
}

/** Optimistically patch one listing in the cache; returns a rollback snapshot. */
async function patchListing(
  qc: QueryClient,
  mode: RepoMode,
  boardId: string,
  listingId: string,
  patch: (l: ListingSummary) => ListingSummary,
) {
  const key = qk.listings(mode, boardId)
  await qc.cancelQueries({ queryKey: key })
  const previous = qc.getQueryData<ListingSummary[]>(key)
  qc.setQueryData<ListingSummary[]>(key, (old) => old?.map((l) => (l.id === listingId ? patch(l) : l)))
  return { previous }
}

export function useCreateListing(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fields, initialNote }: { fields: ListingFields; initialNote: string | null }) =>
      repo.createListing(boardId, fields, initialNote),
    onSuccess: async (listing) => {
      track({ name: 'listing_added', boardId })
      // Show the new listing immediately, then reconcile with the server.
      qc.setQueryData<ListingSummary[]>(qk.listings(repo.mode, boardId), (old) =>
        old && !old.some((l) => l.id === listing.id) ? [{ ...listing, images: [], votes: [], tour: null }, ...old] : old,
      )
      await invalidateBoard(qc, repo.mode, boardId)
    },
  })
}

export function useUpdateListing(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ listingId, fields }: { listingId: string; fields: ListingFields }) =>
      repo.updateListing(boardId, listingId, fields),
    onSettled: () => invalidateBoard(qc, repo.mode, boardId),
  })
}

export function useDeleteListing(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (listingId: string) => repo.deleteListing(boardId, listingId),
    onSuccess: (_data, listingId) => {
      qc.setQueryData<ListingSummary[]>(qk.listings(repo.mode, boardId), (old) => old?.filter((l) => l.id !== listingId))
      qc.removeQueries({ queryKey: qk.notes(repo.mode, boardId, listingId) })
    },
    onSettled: () => invalidateBoard(qc, repo.mode, boardId),
  })
}

export function useSetStatus(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ listingId, status }: { listingId: string; status: ListingStatus }) =>
      repo.setStatus(boardId, listingId, status),
    onMutate: ({ listingId, status }) => patchListing(qc, repo.mode, boardId, listingId, (l) => ({ ...l, status })),
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.listings(repo.mode, boardId), ctx.previous)
    },
    onSettled: () => invalidateBoard(qc, repo.mode, boardId),
  })
}

/** Set or clear (null) the current user's vote. Optimistic with rollback on failure. */
export function useVote(boardId: string, currentUserId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ listingId, vote }: { listingId: string; vote: VoteValue | null }) =>
      repo.setVote(boardId, listingId, vote),
    onMutate: ({ listingId, vote }) =>
      patchListing(qc, repo.mode, boardId, listingId, (l) => {
        const others = l.votes.filter((v) => v.userId !== currentUserId)
        return {
          ...l,
          votes: vote ? [...others, { listingId, userId: currentUserId, vote, updatedAt: new Date().toISOString() }] : others,
        }
      }),
    onSuccess: (_d, { vote }) => {
      if (vote) track({ name: 'vote_submitted', boardId })
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.listings(repo.mode, boardId), ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.listings(repo.mode, boardId) }),
  })
}

export function useSetTour(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ listingId, tour }: { listingId: string; tour: TourInput }) => repo.setTour(boardId, listingId, tour),
    onSuccess: () => track({ name: 'tour_scheduled', boardId }),
    onSettled: () => invalidateBoard(qc, repo.mode, boardId),
  })
}

export function useClearTour(boardId: string) {
  const repo = useRepo()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (listingId: string) => repo.clearTour(boardId, listingId),
    onSettled: () => invalidateBoard(qc, repo.mode, boardId),
  })
}
