import { describe, expect, it } from 'vitest'
import { checkSubmission, parseAvailability, restoreAvailability, serializeAvailability } from './availability'
import { makeSlots } from './testkit'

const slots = makeSlots('v', '2027-03-10T18:00:00Z', 4)
const ids = new Set(slots.map((s) => s.id))

describe('availability serialization', () => {
  it('serializes in slot order and round-trips', () => {
    const draft = { 'v-3': 'available', 'v-0': 'preferred', 'v-1': 'available' } as const
    const payload = serializeAvailability(draft, slots)
    expect(payload).toEqual({ available: ['v-1', 'v-3'], preferred: ['v-0'] })
    expect(parseAvailability(payload, ids)).toEqual({ ok: true, value: draft })
  })

  it('rejects unknown (e.g. cross-event) slot ids, duplicates, and conflicting states', () => {
    expect(parseAvailability({ available: ['other-event-slot'], preferred: [] }, ids)).toEqual({ ok: false, error: 'unknown_slot' })
    expect(parseAvailability({ available: ['v-0', 'v-0'], preferred: [] }, ids)).toEqual({ ok: false, error: 'duplicate_slot' })
    expect(parseAvailability({ available: ['v-0'], preferred: ['v-0'] }, ids)).toEqual({ ok: false, error: 'conflicting_state' })
  })

  it('restores local drafts leniently', () => {
    expect(restoreAvailability({ available: ['v-0', 'gone', 'v-1'], preferred: ['v-1'] }, ids)).toEqual({ 'v-0': 'available', 'v-1': 'preferred' })
    expect(restoreAvailability(null, ids)).toEqual({})
  })
})

describe('checkSubmission', () => {
  it('requires a slot, or an explicit none-work with no slots', () => {
    expect(checkSubmission({}, false)).toBe('empty')
    expect(checkSubmission({ 'v-0': 'available' }, false)).toBeNull()
    expect(checkSubmission({}, true)).toBeNull()
    expect(checkSubmission({ 'v-0': 'available' }, true)).toBe('none_work_with_slots')
  })
})
