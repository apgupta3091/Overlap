// Browser-local implementation of EventService for Week 1 (no backend yet) and for the demo.
// It enforces the same rules the Edge Function will (schedule, limits, strict availability parsing,
// edit tokens) so the UI is built against realistic behavior. Events live only in this browser.
import { checkSubmission, parseAvailability } from '../domain/availability.ts'
import { LIMITS } from '../domain/limits.ts'
import { buildSchedule } from '../domain/schedule.ts'
import { Temporal } from '../domain/time.ts'
import type { OverlapEvent, ParticipantResponse } from '../domain/types.ts'
import { randomId } from '../domain/ids.ts'
import { ServiceError } from './errors'
import type { CreateEventInput, EventService, EventSnapshot, ResponseInput } from './service'
import { readJson, writeJson, type KeyValueStore } from './store'
import { checkDescription, checkExpected, checkName, checkTitle, cleanText } from '../domain/fields.ts'

export interface StoredEvent {
  event: OverlapEvent
  responses: ParticipantResponse[]
  /** Local stand-ins for credentials; the server stores only hashes (Chunk 8). */
  adminToken: string
  editTokens: Record<string, string>
}

const key = (publicId: string) => `overlap:local:event:${publicId}`

export interface LocalServiceOptions {
  now?: () => Temporal.Instant
  /** Artificial latency so loading states are exercised in dev. */
  delayMs?: number
}

export class LocalEventService implements EventService {
  private readonly store: KeyValueStore
  private readonly now: () => Temporal.Instant
  private readonly delayMs: number

  constructor(store: KeyValueStore, options: LocalServiceOptions = {}) {
    this.store = store
    this.now = options.now ?? (() => Temporal.Now.instant())
    this.delayMs = options.delayMs ?? 0
  }

  private async tick() {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs))
  }

  private load(publicId: string): StoredEvent {
    const stored = /^[A-Za-z0-9_-]{1,32}$/.test(publicId) ? readJson<StoredEvent>(this.store, key(publicId)) : null
    if (!stored) throw new ServiceError('not_found', 'This event doesn’t exist.')
    return stored
  }

  private save(stored: StoredEvent) {
    writeJson(this.store, key(stored.event.publicId), stored)
  }

  async createEvent(input: CreateEventInput, publicId: string = randomId(10)) {
    await this.tick()
    const fieldError =
      checkTitle(input.title) ??
      checkName(input.organizerName, LIMITS.organizerNameMax) ??
      checkDescription(input.description ?? '') ??
      checkExpected(input.expectedParticipants === null ? '' : String(input.expectedParticipants))
    if (fieldError) throw new ServiceError('invalid', fieldError)

    const now = this.now()
    const schedule = buildSchedule({ timezone: input.timezone, durationMinutes: input.durationMinutes, ranges: input.ranges }, now)
    if (!schedule.ok) throw new ServiceError('invalid', 'Some dates or times need fixing.', schedule.issues)

    const ranges: OverlapEvent['ranges'] = []
    const slots: OverlapEvent['slots'] = []
    for (const r of schedule.value.ranges) {
      const rangeId = randomId(8)
      ranges.push({ id: rangeId, originalLocalDate: r.originalLocalDate, startAt: r.startAt, endAt: r.endAt })
      for (const s of r.slots) slots.push({ id: randomId(10), rangeId, startAt: s.startAt, endAt: s.endAt, sortOrder: s.sortOrder })
    }
    const ts = now.toString()
    const description = input.description?.trim() || null
    const event: OverlapEvent = {
      publicId,
      title: cleanText(input.title),
      description,
      organizerName: cleanText(input.organizerName),
      timezone: input.timezone,
      durationMinutes: input.durationMinutes,
      expectedParticipants: input.expectedParticipants,
      status: 'open',
      finalStartAt: null,
      finalEndAt: null,
      revision: 1,
      createdAt: ts,
      updatedAt: ts,
      expiresAt: schedule.value.expiresAt,
      ranges,
      slots,
    }
    const adminToken = randomId(32)
    this.save({ event, responses: [], adminToken, editTokens: {} })
    return { publicId, adminToken }
  }

  async getEvent(publicId: string): Promise<EventSnapshot> {
    await this.tick()
    const { event, responses } = this.load(publicId)
    return structuredClone({ event, responses })
  }

  private buildResponse(stored: StoredEvent, input: ResponseInput, base: Pick<ParticipantResponse, 'id' | 'createdAt' | 'revision'>): ParticipantResponse {
    const nameError = checkName(input.displayName)
    if (nameError) throw new ServiceError('invalid', nameError)
    const parsed = parseAvailability(input.availability, new Set(stored.event.slots.map((s) => s.id)))
    if (!parsed.ok) throw new ServiceError('invalid', 'That availability doesn’t match this event’s times. Reload and try again.')
    const issue = checkSubmission(parsed.value, input.noneWork)
    if (issue === 'empty') throw new ServiceError('invalid', 'Mark at least one time, or choose “None of these times work”.')
    if (issue) throw new ServiceError('invalid', 'Clear your selected times before choosing “None of these times work”.')
    return {
      ...base,
      displayName: cleanText(input.displayName),
      noneWork: input.noneWork,
      updatedAt: this.now().toString(),
      slots: parsed.value,
    }
  }

  async createResponse(publicId: string, input: ResponseInput) {
    await this.tick()
    const stored = this.load(publicId)
    if (stored.event.status !== 'open') throw new ServiceError('conflict', 'This event is no longer collecting availability.')
    if (stored.responses.length >= LIMITS.maxResponses) {
      throw new ServiceError('limit_reached', `This event already has ${LIMITS.maxResponses} responses, the maximum.`)
    }
    const response = this.buildResponse(stored, input, { id: randomId(12), createdAt: this.now().toString(), revision: 1 })
    const editToken = randomId(32)
    stored.responses.push(response)
    stored.editTokens[response.id] = editToken
    this.save(stored)
    return { response: structuredClone(response), editToken }
  }

  async updateResponse(publicId: string, responseId: string, editToken: string, input: ResponseInput) {
    await this.tick()
    const stored = this.load(publicId)
    const index = stored.responses.findIndex((r) => r.id === responseId)
    const existing = stored.responses[index]
    if (!existing || stored.editTokens[responseId] !== editToken) {
      throw new ServiceError('forbidden', 'You can only edit a response from the browser that submitted it.')
    }
    if (stored.event.status !== 'open') throw new ServiceError('conflict', 'This event is no longer collecting availability.')
    const response = this.buildResponse(stored, input, { id: existing.id, createdAt: existing.createdAt, revision: existing.revision + 1 })
    stored.responses[index] = response
    this.save(stored)
    return { response: structuredClone(response) }
  }
}

/** Write an event directly (used to seed the demo). */
export function seedLocalEvent(store: KeyValueStore, stored: StoredEvent): void {
  writeJson(store, key(stored.event.publicId), stored)
}
