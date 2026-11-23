import { Circle } from 'lucide-react'
import type { Member, Vote } from '../../domain/types'
import { VOTE_LABELS } from '../../domain/types'
import { isEveryoneInterested, summarizeVotes } from '../../domain/votes'
import { VOTE_ICONS } from './VoteControl'

const ICON_COLOR = { interested: 'text-good', maybe: 'text-warn', pass: 'text-ink-muted' } as const

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase()
}

/** Compact per-member vote chips plus a text summary. */
export function VoteSummaryCompact({ votes, members, currentUserId }: { votes: Vote[]; members: Member[]; currentUserId: string }) {
  const summary = summarizeVotes(votes, members)
  const agreed = isEveryoneInterested(votes, members)
  const parts: string[] = []
  if (summary.counts.interested) parts.push(`${summary.counts.interested} interested`)
  if (summary.counts.maybe) parts.push(`${summary.counts.maybe} maybe`)
  if (summary.counts.pass) parts.push(`${summary.counts.pass} pass`)
  if (summary.unvoted.length) parts.push(`${summary.unvoted.length} not voted`)
  return (
    <div className="flex items-center gap-2">
      <ul className="flex -space-x-1.5" aria-label="Member votes">
        {summary.byMember.map(({ member, vote }) => {
          const Icon = vote ? VOTE_ICONS[vote] : Circle
          const name = member.userId === currentUserId ? 'You' : member.displayName
          return (
            <li
              key={member.userId}
              title={`${name}: ${vote ? VOTE_LABELS[vote] : 'Not voted'}`}
              className="relative flex size-7 items-center justify-center rounded-full border-2 border-surface bg-sunken text-[10px] font-semibold text-ink-muted"
            >
              <span aria-hidden>{initials(name)}</span>
              <span className="sr-only">
                {name}: {vote ? VOTE_LABELS[vote] : 'Not voted'}
              </span>
              <span aria-hidden className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-surface">
                <Icon className={`size-3 ${vote ? ICON_COLOR[vote] : 'text-ink-faint'}`} strokeWidth={2.5} />
              </span>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-ink-muted">
        {agreed ? <span className="font-semibold text-good">Everyone’s interested</span> : parts.join(' · ') || 'No votes yet'}
      </p>
    </div>
  )
}

/** Full named list for the details page. */
export function MemberVoteList({ votes, members, currentUserId }: { votes: Vote[]; members: Member[]; currentUserId: string }) {
  const summary = summarizeVotes(votes, members)
  return (
    <ul className="divide-y divide-line">
      {summary.byMember.map(({ member, vote }) => {
        const Icon = vote ? VOTE_ICONS[vote] : Circle
        return (
          <li key={member.userId} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="font-medium">
              {member.displayName}
              {member.userId === currentUserId && <span className="font-normal text-ink-muted"> (you)</span>}
            </span>
            <span className={`inline-flex items-center gap-1.5 ${vote ? ICON_COLOR[vote] : 'text-ink-faint'}`}>
              <Icon aria-hidden className="size-4" />
              {vote ? VOTE_LABELS[vote] : 'Hasn’t voted'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
