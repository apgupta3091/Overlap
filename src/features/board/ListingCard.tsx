import { Link } from 'react-router'
import { BedDouble, Bath, CalendarClock, ExternalLink, Ruler } from 'lucide-react'
import type { ListingSummary, Member, VoteValue } from '../../domain/types'
import { voteOf } from '../../domain/votes'
import { displayHost, isSafeHttpUrl } from '../../domain/url'
import { formatTourDateTime } from '../../lib/dates'
import { hasUpcomingTour } from '../../domain/filters'
import { CardCost, BudgetIndicator } from './CostSummary'
import { ListingPhoto } from './ListingImage'
import { StatusBadge } from './StatusBadge'
import { VoteControl } from './VoteControl'
import { VoteSummaryCompact } from './VoteSummary'
import { listingPath } from './BoardScope'

export function listingTitle(l: { title: string | null; address: string | null }): string {
  return l.title ?? l.address ?? 'Untitled apartment'
}

export function formatBedrooms(bedrooms: number | null): string | null {
  if (bedrooms === null) return null
  return bedrooms === 0 ? 'Studio' : `${bedrooms} bd`
}

interface ListingCardProps {
  listing: ListingSummary
  boardId: string
  basePath: string
  members: Member[]
  currentUserId: string
  budgetCents: number | null
  selected: boolean
  selectionFull: boolean
  onToggleCompare: (id: string) => void
  onVote: (listingId: string, vote: VoteValue | null) => void
  now: Date
}

export function ListingCard({
  listing,
  boardId,
  basePath,
  members,
  currentUserId,
  budgetCents,
  selected,
  selectionFull,
  onToggleCompare,
  onVote,
  now,
}: ListingCardProps) {
  const title = listingTitle(listing)
  const subtitle = [listing.neighborhood, listing.title ? listing.address : null].filter(Boolean).join(' · ')
  const myVote = voteOf(listing.votes, currentUserId)
  const compareDisabled = !selected && selectionFull
  const compareId = `compare-${listing.id}`
  const facts = [
    { Icon: BedDouble, text: formatBedrooms(listing.bedrooms), label: 'Bedrooms' },
    { Icon: Bath, text: listing.bathrooms === null ? null : `${listing.bathrooms} ba`, label: 'Bathrooms' },
    { Icon: Ruler, text: listing.squareFeet === null ? null : `${listing.squareFeet.toLocaleString()} sq ft`, label: 'Size' },
  ].filter((f) => f.text)
  const upcoming = hasUpcomingTour(listing, now) ? listing.tour : null

  return (
    <article
      aria-labelledby={`title-${listing.id}`}
      className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-surface shadow-card transition-shadow hover:shadow-raised ${
        selected ? 'border-accent ring-2 ring-accent/30' : 'border-line'
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sunken">
        <ListingPhoto boardId={boardId} image={listing.images[0]} variant="thumb" alt="" />
        <StatusBadge status={listing.status} className="absolute top-3 left-3 shadow-sm" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 id={`title-${listing.id}`} className="text-[17px] leading-snug font-semibold">
            {/* Stretched link: the card is clickable, but other controls stay separate (no nesting). */}
            <Link
              to={listingPath(basePath, listing.id)}
              className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:outline-3 focus-visible:after:outline-accent"
            >
              {title}
            </Link>
          </h3>
          {subtitle && <p className="mt-0.5 truncate text-sm text-ink-muted">{subtitle}</p>}
        </div>

        <CardCost listing={listing} />
        <BudgetIndicator budgetCents={budgetCents} listing={listing} />

        {facts.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
            {facts.map(({ Icon, text, label }) => (
              <li key={label} className="inline-flex items-center gap-1">
                <Icon aria-hidden className="size-4" />
                <span className="sr-only">{label}: </span>
                {text}
              </li>
            ))}
          </ul>
        )}

        {upcoming && (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[#284a73]">
            <CalendarClock aria-hidden className="size-4" />
            Tour {formatTourDateTime(upcoming.startsAt)}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-3">
          <VoteSummaryCompact votes={listing.votes} members={members} currentUserId={currentUserId} />
          <div className="relative z-10">
            <VoteControl value={myVote} onChange={(v) => onVote(listing.id, v)} subject={title} />
          </div>
          <div className="relative z-10 flex items-center justify-between gap-2">
            <label
              htmlFor={compareId}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg pr-2 text-sm ${compareDisabled ? 'cursor-not-allowed text-ink-faint' : ''}`}
              title={compareDisabled ? 'You can compare up to 3 apartments. Deselect one first.' : undefined}
            >
              <input
                id={compareId}
                type="checkbox"
                checked={selected}
                disabled={compareDisabled}
                onChange={() => onToggleCompare(listing.id)}
                aria-describedby={compareDisabled ? 'compare-limit-help' : undefined}
                className="size-4.5 accent-[var(--color-accent)]"
              />
              Compare
            </label>
            {isSafeHttpUrl(listing.listingUrl) && (
              <a
                href={listing.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-muted hover:bg-sunken hover:text-ink"
              >
                {displayHost(listing.listingUrl)}
                <ExternalLink aria-hidden className="size-3.5" />
                <span className="sr-only">(opens original listing in a new tab)</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
