// Test helpers for building slots and responses. Not used by production code.
import { Temporal } from './time.ts'
import type { EventSlot, ParticipantResponse, SlotState } from './types.ts'

let order = 0
/** `count` contiguous 30-minute slots starting at `startIso`, ids `${rangeId}-${i}`. */
export function makeSlots(rangeId: string, startIso: string, count: number): EventSlot[] {
  const start = Temporal.Instant.from(startIso)
  return Array.from({ length: count }, (_, i) => ({
    id: `${rangeId}-${i}`,
    rangeId,
    startAt: start.add({ minutes: 30 * i }).toString(),
    endAt: start.add({ minutes: 30 * (i + 1) }).toString(),
    sortOrder: order++,
  }))
}

export function makeResponse(id: string, slots: Record<string, SlotState>, opts: { noneWork?: boolean; name?: string; createdAt?: string } = {}): ParticipantResponse {
  return {
    id,
    displayName: opts.name ?? id,
    noneWork: opts.noneWork ?? false,
    revision: 1,
    createdAt: opts.createdAt ?? '2027-01-01T00:00:00Z',
    updatedAt: opts.createdAt ?? '2027-01-01T00:00:00Z',
    slots,
  }
}

/** Mark the given slot ids with one state. */
export function mark(ids: string[], state: SlotState = 'available'): Record<string, SlotState> {
  return Object.fromEntries(ids.map((id) => [id, state]))
}
