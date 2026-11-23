import type { Member, Vote, VoteValue } from './types'

export interface MemberVote {
  member: Member
  vote: VoteValue | null
}

export interface VoteSummary {
  counts: Record<VoteValue, number>
  byMember: MemberVote[]
  unvoted: Member[]
}

/** Summarize votes, counting only people who are current board members. */
export function summarizeVotes(votes: readonly Vote[], members: readonly Member[]): VoteSummary {
  const voteByUser = new Map(votes.map((v) => [v.userId, v.vote]))
  const counts: Record<VoteValue, number> = { interested: 0, maybe: 0, pass: 0 }
  const byMember: MemberVote[] = []
  const unvoted: Member[] = []
  for (const member of members) {
    const vote = voteByUser.get(member.userId) ?? null
    byMember.push({ member, vote })
    if (vote) counts[vote] += 1
    else unvoted.push(member)
  }
  return { counts, byMember, unvoted }
}

/**
 * "Everyone interested": every current member has voted, and every one of them voted Interested.
 * Unvoted members break agreement; votes from former members are ignored.
 */
export function isEveryoneInterested(votes: readonly Vote[], members: readonly Member[]): boolean {
  if (members.length === 0) return false
  const voteByUser = new Map(votes.map((v) => [v.userId, v.vote]))
  return members.every((m) => voteByUser.get(m.userId) === 'interested')
}

export function voteOf(votes: readonly Vote[], userId: string): VoteValue | null {
  return votes.find((v) => v.userId === userId)?.vote ?? null
}

/** Clicking the currently active vote clears it. */
export function nextVote(current: VoteValue | null, clicked: VoteValue): VoteValue | null {
  return current === clicked ? null : clicked
}
