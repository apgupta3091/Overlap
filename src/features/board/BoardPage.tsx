import { useEffect, useMemo, useState } from 'react'
import { Home, SearchX, Users } from 'lucide-react'
import { applyBoardFilters, countHiddenArchived, DEFAULT_FILTERS, filtersAreDefault, type BoardFilters } from '../../domain/filters'
import { toggleCompareSelection } from '../../domain/compare'
import { formatCents } from '../../domain/money'
import type { VoteValue } from '../../domain/types'
import { useBoard } from '../../data/hooks/boards'
import { useListings, useVote } from '../../data/hooks/listings'
import { errorMessage } from '../../data/errors'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import { useBoardScope } from './BoardScope'
import { CompareBar } from './CompareBar'
import { FilterBar } from './FilterBar'
import { ListingCard } from './ListingCard'

function useCompareSelection(boardId: string, validIds: string[] | undefined) {
  const key = `shortlist.compare.${boardId}`
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(selected))
    } catch {
      // Selection still works in memory.
    }
  }, [key, selected])
  // Ignore selections for listings that no longer exist.
  const effective = validIds ? selected.filter((id) => validIds.includes(id)) : selected
  return [effective, setSelected] as const
}

/** Current time, refreshed every minute (for "upcoming tour" logic). */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

export function BoardPage() {
  const { boardId, basePath } = useBoardScope()
  const toast = useToast()
  const boardQuery = useBoard(boardId)
  const listingsQuery = useListings(boardId)
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS)
  const ids = useMemo(() => listingsQuery.data?.map((l) => l.id), [listingsQuery.data])
  const [selected, setSelected] = useCompareSelection(boardId, ids)
  const currentUserId = boardQuery.data?.currentUserId ?? ''
  const vote = useVote(boardId, currentUserId)
  const now = useNow()

  if (boardQuery.isPending || listingsQuery.isPending) return <Spinner label="Loading board…" />
  if (boardQuery.isError || listingsQuery.isError) {
    return (
      <ErrorState
        title="We couldn’t open this board"
        message={errorMessage(boardQuery.error ?? listingsQuery.error)}
        action={<Button onClick={() => { void boardQuery.refetch(); void listingsQuery.refetch() }}>Try again</Button>}
      />
    )
  }

  const { board, members } = boardQuery.data
  const listings = listingsQuery.data
  const visible = applyBoardFilters(listings, filters, { members, currentUserId, now })
  const hiddenArchived = countHiddenArchived(listings, filters)

  function onVote(listingId: string, next: VoteValue | null) {
    vote.mutate(
      { listingId, vote: next },
      {
        onSuccess: () => toast.announce(next ? `Voted ${next}` : 'Vote cleared'),
        onError: (e) => toast.error(`Your vote wasn’t saved and has been undone. ${errorMessage(e)}`),
      },
    )
  }

  function onToggleCompare(id: string) {
    const result = toggleCompareSelection(selected, id)
    if (result.limitReached) toast.show('You can compare up to 3 apartments. Deselect one first.')
    setSelected(result.selected)
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{board.name}</h1>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
            {board.locationLabel && <span>{board.locationLabel}</span>}
            {board.monthlyBudgetCents !== null && <span>Budget {formatCents(board.monthlyBudgetCents)}/mo total</span>}
            <span className="inline-flex items-center gap-1">
              <Users aria-hidden className="size-3.5" />
              {members.map((m) => (m.userId === currentUserId ? 'You' : m.displayName)).join(', ')}
            </span>
          </p>
        </div>
      </header>

      {listings.length === 0 ? (
        <EmptyState icon={<Home aria-hidden className="size-6" />} title="No apartments yet">
          Found a place you like? Save its link here with the monthly rent — everything else is optional. Your roommates
          can vote and add notes.
        </EmptyState>
      ) : (
        <>
          <FilterBar filters={filters} onChange={setFilters} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
            <p aria-live="polite">
              Showing {visible.length} of {listings.length} {listings.length === 1 ? 'apartment' : 'apartments'}
            </p>
            {hiddenArchived > 0 && (
              <button type="button" className="font-medium text-accent-strong underline-offset-2 hover:underline" onClick={() => setFilters({ ...filters, status: 'all' })}>
                Show {hiddenArchived} rejected or unavailable
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <NoMatches filters={filters} onReset={() => setFilters(DEFAULT_FILTERS)} onShowAll={() => setFilters({ ...DEFAULT_FILTERS, status: 'all' })} />
          ) : (
            <>
              {filters.sort === 'upcoming_tour' && !visible.some((l) => l.tour && new Date(l.tour.startsAt) >= now) && (
                <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
                  No tours scheduled yet. Open an apartment to schedule one.
                </p>
              )}
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((l) => (
                  <li key={l.id} className="flex min-w-0">
                    <div className="flex w-full min-w-0 flex-col">
                      <ListingCard
                        listing={l}
                        boardId={boardId}
                        basePath={basePath}
                        members={members}
                        currentUserId={currentUserId}
                        budgetCents={board.monthlyBudgetCents}
                        selected={selected.includes(l.id)}
                        selectionFull={selected.length >= 3}
                        onToggleCompare={onToggleCompare}
                        onVote={onVote}
                        now={now}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <CompareBar basePath={basePath} selected={selected} onClear={() => setSelected([])} />
    </div>
  )
}

function NoMatches({ filters, onReset, onShowAll }: { filters: BoardFilters; onReset: () => void; onShowAll: () => void }) {
  if (filters.everyoneInterested) {
    return (
      <EmptyState icon={<Users aria-hidden className="size-6" />} title="No shared favorites yet" action={<Button onClick={onReset}>Clear filters</Button>}>
        An apartment shows up here once every member has voted Interested. Members who haven’t voted don’t count as agreement.
      </EmptyState>
    )
  }
  if (filters.status === 'tour_scheduled') {
    return (
      <EmptyState title="No tours scheduled" action={<Button onClick={onReset}>Clear filters</Button>}>
        Open an apartment and add a tour time to see it here.
      </EmptyState>
    )
  }
  return (
    <EmptyState icon={<SearchX aria-hidden className="size-6" />} title="No apartments match these filters" action={filtersAreDefault(filters) ? <Button onClick={onShowAll}>Show all statuses</Button> : <Button onClick={onReset}>Clear filters</Button>}>
      Try a different search or show all statuses.
    </EmptyState>
  )
}
