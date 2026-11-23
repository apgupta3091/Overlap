import { Search } from 'lucide-react'
import { SORT_LABELS, type BoardFilters, type MyVoteFilter, type SortKey, type StatusFilter } from '../../domain/filters'
import { LISTING_STATUSES, STATUS_LABELS, VOTE_LABELS, VOTE_VALUES } from '../../domain/types'

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Active listings' },
  { value: 'all', label: 'All statuses' },
  ...LISTING_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
]
const MY_VOTE_OPTIONS: { value: MyVoteFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  ...VOTE_VALUES.map((v) => ({ value: v, label: VOTE_LABELS[v] })),
  { value: 'unvoted', label: 'Not voted yet' },
]

const selectCls = 'min-h-10 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm'

export function FilterBar({ filters, onChange }: { filters: BoardFilters; onChange: (f: BoardFilters) => void }) {
  const set = <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) => onChange({ ...filters, [key]: value })
  return (
    <div role="search" aria-label="Filter listings" className="grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
        <label htmlFor="filter-search" className="text-xs font-medium text-ink-muted">Search</label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            id="filter-search"
            type="search"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Title, address, or neighborhood"
            className={`${selectCls} pl-8`}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-status" className="text-xs font-medium text-ink-muted">Status</label>
        <select id="filter-status" className={selectCls} value={filters.status} onChange={(e) => set('status', e.target.value as StatusFilter)}>
          {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-myvote" className="text-xs font-medium text-ink-muted">My vote</label>
        <select id="filter-myvote" className={selectCls} value={filters.myVote} onChange={(e) => set('myVote', e.target.value as MyVoteFilter)}>
          {MY_VOTE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-sort" className="text-xs font-medium text-ink-muted">Sort by</label>
        <select id="filter-sort" className={selectCls} value={filters.sort} onChange={(e) => set('sort', e.target.value as SortKey)}>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
        </select>
      </div>
      <label htmlFor="filter-agree" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm whitespace-nowrap">
        <input
          id="filter-agree"
          type="checkbox"
          checked={filters.everyoneInterested}
          onChange={(e) => set('everyoneInterested', e.target.checked)}
          className="size-4 accent-[var(--color-accent)]"
        />
        Everyone interested
      </label>
    </div>
  )
}
