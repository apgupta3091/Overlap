import { describe, expect, it } from 'vitest'
import { LIMITS } from '../domain/limits.ts'
import { Temporal } from '../domain/time.ts'
import { ServiceError } from './errors'
import { LocalEventService } from './localService'
import type { CreateEventInput } from './service'
import { memoryStore } from './store'

const now = Temporal.Instant.from('2027-05-03T12:00:00Z')
const input: CreateEventInput = {
  title: '  Study   group ',
  description: null,
  organizerName: 'Priya',
  timezone: 'America/New_York',
  durationMinutes: 60,
  expectedParticipants: null,
  ranges: [{ date: '2027-05-04', start: '09:00', end: '11:00' }],
}

async function setup() {
  const service = new LocalEventService(memoryStore(), { now: () => now })
  const created = await service.createEvent(input)
  const { event } = await service.getEvent(created.publicId)
  return { service, created, event }
}

describe('LocalEventService', () => {
  it('creates an event with server-generated UTC slots and normalized text', async () => {
    const { event } = await setup()
    expect(event.title).toBe('Study group')
    expect(event.slots).toHaveLength(4)
    expect(event.slots[0]!.startAt).toBe('2027-05-04T13:00:00Z')
    expect(event.expiresAt).toBe('2027-06-03T15:00:00Z')
  })

  it('rejects invalid schedules with the schedule issues attached', async () => {
    const service = new LocalEventService(memoryStore(), { now: () => now })
    const err = await service.createEvent({ ...input, ranges: [{ date: '2027-05-01', start: '09:00', end: '11:00' }] }).catch((e) => e)
    expect(err).toBeInstanceOf(ServiceError)
    expect(err.issues[0].code).toBe('date_in_past')
  })

  it('reports unknown events as not_found', async () => {
    const service = new LocalEventService(memoryStore())
    await expect(service.getEvent('nope')).rejects.toMatchObject({ code: 'not_found' })
    await expect(service.getEvent('../etc')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('creates and updates a response only with its edit token', async () => {
    const { service, created, event } = await setup()
    const [s0, s1] = event.slots
    const { response, editToken } = await service.createResponse(created.publicId, {
      displayName: 'Sam',
      noneWork: false,
      availability: { available: [s0!.id], preferred: [s1!.id] },
    })
    expect(response.slots).toEqual({ [s0!.id]: 'available', [s1!.id]: 'preferred' })

    await expect(
      service.updateResponse(created.publicId, response.id, 'wrong', { displayName: 'Sam', noneWork: true, availability: { available: [], preferred: [] } }),
    ).rejects.toMatchObject({ code: 'forbidden' })

    const updated = await service.updateResponse(created.publicId, response.id, editToken, { displayName: 'Sam', noneWork: true, availability: { available: [], preferred: [] } })
    expect(updated.response).toMatchObject({ noneWork: true, slots: {}, revision: 2 })
    expect((await service.getEvent(created.publicId)).responses).toHaveLength(1)
  })

  it('rejects empty, conflicting, and foreign-slot submissions', async () => {
    const { service, created, event } = await setup()
    const id = event.slots[0]!.id
    const submit = (available: string[], preferred: string[], noneWork = false) =>
      service.createResponse(created.publicId, { displayName: 'Sam', noneWork, availability: { available, preferred } })
    await expect(submit([], [])).rejects.toMatchObject({ code: 'invalid' })
    await expect(submit([id], [], true)).rejects.toMatchObject({ code: 'invalid' })
    await expect(submit([id], [id])).rejects.toMatchObject({ code: 'invalid' })
    await expect(submit(['other-event-slot'], [])).rejects.toMatchObject({ code: 'invalid' })
    await expect(service.createResponse(created.publicId, { displayName: '   ', noneWork: true, availability: { available: [], preferred: [] } })).rejects.toMatchObject({
      code: 'invalid',
    })
  })

  it(`stops accepting responses at ${LIMITS.maxResponses}`, async () => {
    const { service, created } = await setup()
    for (let i = 0; i < LIMITS.maxResponses; i++) {
      await service.createResponse(created.publicId, { displayName: `P${i}`, noneWork: true, availability: { available: [], preferred: [] } })
    }
    await expect(
      service.createResponse(created.publicId, { displayName: 'Late', noneWork: true, availability: { available: [], preferred: [] } }),
    ).rejects.toMatchObject({ code: 'limit_reached' })
  })
})
