import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react'
import { VOTE_LABELS, VOTE_VALUES, type VoteValue } from '../../domain/types'
import { nextVote } from '../../domain/votes'

export const VOTE_ICONS: Record<VoteValue, typeof ThumbsUp> = {
  interested: ThumbsUp,
  maybe: CircleHelp,
  pass: ThumbsDown,
}

const ACTIVE: Record<VoteValue, string> = {
  interested: 'bg-good text-white border-good',
  maybe: 'bg-warn text-white border-warn',
  pass: 'bg-ink-muted text-white border-ink-muted',
}

interface VoteControlProps {
  value: VoteValue | null
  onChange: (next: VoteValue | null) => void
  /** Used in the group's accessible name, e.g. the apartment title. */
  subject: string
  disabled?: boolean
  size?: 'sm' | 'md'
}

/**
 * Three toggle buttons (aria-pressed). Clicking the active vote clears it.
 * State is conveyed by pressed state, icon fill, and text — not color alone.
 */
export function VoteControl({ value, onChange, subject, disabled, size = 'sm' }: VoteControlProps) {
  return (
    <div role="group" aria-label={`Your vote on ${subject}`} className="flex gap-1.5">
      {VOTE_VALUES.map((v) => {
        const Icon = VOTE_ICONS[v]
        const pressed = value === v
        return (
          <button
            key={v}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onChange(nextVote(value, v))}
            title={pressed ? `Clear your “${VOTE_LABELS[v]}” vote` : `Vote ${VOTE_LABELS[v]}`}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors disabled:opacity-60 ${
              size === 'sm' ? 'min-h-10 px-2 text-[13px]' : 'min-h-11 px-3 text-sm'
            } ${pressed ? ACTIVE[v] : 'border-line-strong bg-surface text-ink hover:bg-sunken'}`}
          >
            <Icon aria-hidden className="size-4" strokeWidth={pressed ? 2.5 : 2} />
            {VOTE_LABELS[v]}
          </button>
        )
      })}
    </div>
  )
}
