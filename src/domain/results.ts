// Group results: per-slot tallies, heat levels, and honest attendance wording.
// Only submitted responses are ever passed in; drafts never reach these functions.
import type { EventSlot, ParticipantResponse, SlotState } from './types.ts'

export interface SlotTally {
  slotId: string
  /** Everyone who can attend: available + preferred. */
  availableCount: number
  preferredCount: number
  /** Available but not preferred. */
  availableOnlyIds: string[]
  preferredIds: string[]
  unavailableIds: string[]
}

/** The effective state of a response for a slot; "none work" responses are unavailable everywhere. */
export function stateOf(response: ParticipantResponse, slotId: string): SlotState | null {
  if (response.noneWork) return null
  return response.slots[slotId] ?? null
}

export function tallySlots(slots: readonly EventSlot[], responses: readonly ParticipantResponse[]): Map<string, SlotTally> {
  const tallies = new Map<string, SlotTally>()
  for (const slot of slots) {
    const t: SlotTally = { slotId: slot.id, availableCount: 0, preferredCount: 0, availableOnlyIds: [], preferredIds: [], unavailableIds: [] }
    for (const r of responses) {
      const s = stateOf(r, slot.id)
      if (s === 'preferred') t.preferredIds.push(r.id)
      else if (s === 'available') t.availableOnlyIds.push(r.id)
      else t.unavailableIds.push(r.id)
    }
    t.preferredCount = t.preferredIds.length
    t.availableCount = t.preferredCount + t.availableOnlyIds.length
    tallies.set(slot.id, t)
  }
  return tallies
}

export const HEAT_LEVELS = 5

/** 0 = nobody; 1..5 scale with the share of respondents available. Full attendance is always 5. */
export function heatLevel(availableCount: number, responseCount: number): number {
  if (availableCount <= 0 || responseCount <= 0) return 0
  return Math.min(HEAT_LEVELS, Math.max(1, Math.ceil((availableCount / responseCount) * HEAT_LEVELS)))
}

/** "All 4 respondents", "3 of 4 respondents" — never implies unanimity unless it's true. */
export function describeAttendance(availableCount: number, responseCount: number): string {
  const noun = responseCount === 1 ? 'respondent' : 'respondents'
  if (responseCount > 0 && availableCount === responseCount) return responseCount === 1 ? 'The 1 respondent is available' : `All ${responseCount} ${noun} available`
  return `${availableCount} of ${responseCount} ${noun} available`
}

/** "4 responses" / "4 of 6 expected participants have responded". Expected is informational only. */
export function describeResponseCount(responseCount: number, expected: number | null): string {
  if (expected !== null && expected >= responseCount) return `${responseCount} of ${expected} expected participants have responded`
  return `${responseCount} ${responseCount === 1 ? 'response' : 'responses'}`
}

/**
 * Display labels that disambiguate duplicate names by submission order: "Sam", "Sam (2)".
 * Names are labels, not identity — two people may share one.
 */
export function displayLabels(responses: readonly ParticipantResponse[]): Map<string, string> {
  const ordered = [...responses].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const totals = new Map<string, number>()
  for (const r of ordered) {
    const key = r.displayName.trim().toLocaleLowerCase()
    totals.set(key, (totals.get(key) ?? 0) + 1)
  }
  const seen = new Map<string, number>()
  const labels = new Map<string, string>()
  for (const r of ordered) {
    const key = r.displayName.trim().toLocaleLowerCase()
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    labels.set(r.id, (totals.get(key) ?? 0) > 1 && n > 1 ? `${r.displayName} (${n})` : r.displayName)
  }
  return labels
}
