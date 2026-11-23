import { Bookmark, CalendarCheck, CircleSlash, FileCheck2, Star, XCircle } from 'lucide-react'
import { LISTING_STATUSES, STATUS_LABELS, type ListingStatus } from '../../domain/types'

const STYLES: Record<ListingStatus, { cls: string; Icon: typeof Bookmark }> = {
  saved: { cls: 'bg-surface text-ink-muted border-line-strong', Icon: Bookmark },
  shortlisted: { cls: 'bg-accent-soft text-accent-strong border-accent/25', Icon: Star },
  tour_scheduled: { cls: 'bg-[#e8eef6] text-[#284a73] border-[#284a73]/20', Icon: CalendarCheck },
  applied: { cls: 'bg-good-soft text-good border-good/25', Icon: FileCheck2 },
  rejected: { cls: 'bg-sunken text-ink-muted border-line-strong', Icon: XCircle },
  unavailable: { cls: 'bg-sunken text-ink-muted border-line-strong', Icon: CircleSlash },
}

export function StatusBadge({ status, className = '' }: { status: ListingStatus; className?: string }) {
  const { cls, Icon } = STYLES[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${cls} ${className}`}>
      <Icon aria-hidden className="size-3.5" />
      {STATUS_LABELS[status]}
    </span>
  )
}

export const STATUS_OPTIONS = LISTING_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))

export function StatusSelect({
  value,
  onChange,
  disabled,
  id,
  label = 'Status',
  hideLabel = false,
}: {
  value: ListingStatus
  onChange: (s: ListingStatus) => void
  disabled?: boolean
  id: string
  label?: string
  hideLabel?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-sm font-medium'}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ListingStatus)}
        className="min-h-10 rounded-lg border border-line-strong bg-surface px-2.5 text-sm"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
