// A participant's availability: a map of slotId → state. Absent means unavailable.
// "Preferred" implies available; a slot holds exactly one state.
import { z } from 'zod'
import { LIMITS } from './limits.ts'
import type { EventSlot, SlotState } from './types.ts'

export type Availability = Record<string, SlotState>

/** Wire/storage format: two disjoint, sorted id lists. Compact and easy to validate. */
export interface AvailabilityPayload {
  available: string[]
  preferred: string[]
}

const MAX_SLOT_IDS = LIMITS.maxDates * (LIMITS.maxRangeMinutes / 30)

export const availabilityPayloadSchema = z.object({
  available: z.array(z.string().min(1).max(64)).max(MAX_SLOT_IDS),
  preferred: z.array(z.string().min(1).max(64)).max(MAX_SLOT_IDS),
})

/** Serialize in event slot order so payloads are deterministic. */
export function serializeAvailability(availability: Availability, slots: readonly EventSlot[]): AvailabilityPayload {
  const ordered = [...slots].sort((a, b) => a.sortOrder - b.sortOrder)
  const out: AvailabilityPayload = { available: [], preferred: [] }
  for (const slot of ordered) {
    const state = availability[slot.id]
    if (state === 'available') out.available.push(slot.id)
    else if (state === 'preferred') out.preferred.push(slot.id)
  }
  return out
}

export type ParseAvailabilityError = 'unknown_slot' | 'conflicting_state' | 'duplicate_slot'

/**
 * Strictly parse a payload against the event's slot ids. Unknown ids (e.g. a slot from another
 * event) are an error, not silently dropped, so the server can reject tampered requests.
 */
export function parseAvailability(
  payload: AvailabilityPayload,
  validSlotIds: ReadonlySet<string>,
): { ok: true; value: Availability } | { ok: false; error: ParseAvailabilityError } {
  const value: Availability = {}
  for (const [ids, state] of [
    [payload.available, 'available'],
    [payload.preferred, 'preferred'],
  ] as const) {
    for (const id of ids) {
      if (!validSlotIds.has(id)) return { ok: false, error: 'unknown_slot' }
      const existing = value[id]
      if (existing === state) return { ok: false, error: 'duplicate_slot' }
      if (existing) return { ok: false, error: 'conflicting_state' }
      value[id] = state
    }
  }
  return { ok: true, value }
}

/** Lenient restore for local drafts: keep only ids that still exist; preferred wins on conflict. */
export function restoreAvailability(payload: Partial<AvailabilityPayload> | null | undefined, validSlotIds: ReadonlySet<string>): Availability {
  const value: Availability = {}
  for (const id of payload?.available ?? []) if (validSlotIds.has(id)) value[id] = 'available'
  for (const id of payload?.preferred ?? []) if (validSlotIds.has(id)) value[id] = 'preferred'
  return value
}

export function countSelected(availability: Availability): number {
  return Object.keys(availability).length
}

export type SubmissionIssue = 'empty' | 'none_work_with_slots'

/** A submission needs at least one slot, or an explicit "none of these times work" with no slots. */
export function checkSubmission(availability: Availability, noneWork: boolean): SubmissionIssue | null {
  const n = countSelected(availability)
  if (noneWork) return n > 0 ? 'none_work_with_slots' : null
  return n === 0 ? 'empty' : null
}
