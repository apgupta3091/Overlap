import { describe, expect, it, vi } from 'vitest'
import { Temporal } from '../../../src/domain/time.ts'
import type { ParticipantResponse, SlotState } from '../../../src/domain/types.ts'
import { DbError, type CreateEventRow, type Db, type Snapshot } from './db.types.ts'
import { createHandler, MAX_BODY_BYTES } from './handler.ts'
import { hashToken } from './tokens.ts'

const NOW = Temporal.Instant.from('2027-05-03T12:00:00Z')
const ORIGIN = 'http://localhost:5173'
const BASE = 'http://127.0.0.1:54321/functions/v1/api'

/** In-memory stand-in mirroring the SQL functions' behavior. */
function fakeDb() {
  const events = new Map<string, { row: CreateEventRow; slots: string[]; responses: (ParticipantResponse & { hash: string })[] }>()
  let n = 0
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  const db: Db = {
    createEvent: vi.fn(async (row: CreateEventRow) => {
      if (events.has(row.publicId)) throw new DbError('duplicate_public_id')
      events.set(row.publicId, { row, slots: row.ranges.flatMap((r) => r.slots.map(() => uuid())), responses: [] })
    }),
    getEvent: vi.fn(async (publicId: string): Promise<Snapshot | null> => {
      const e = events.get(publicId)
      if (!e) return null
      return {
        event: {
          publicId,
          title: e.row.title,
          description: e.row.description,
          organizerName: e.row.organizerName,
          timezone: e.row.timezone,
          durationMinutes: e.row.durationMinutes,
          expectedParticipants: e.row.expectedParticipants,
          status: 'open',
          finalStartAt: null,
          finalEndAt: null,
          revision: 1 + e.responses.length,
          createdAt: e.row.now,
          updatedAt: e.row.now,
          expiresAt: e.row.expiresAt,
          ranges: [],
          slots: [],
        },
        responses: e.responses.map(({ hash: _hash, ...r }) => r),
      }
    }),
    submitResponse: vi.fn(async (r) => {
      const e = events.get(r.publicId)
      if (!e) throw new DbError('not_found')
      if (![...r.available, ...r.preferred].every((id) => e.slots.includes(id))) throw new DbError('invalid')
      const slots: Record<string, SlotState> = {}
      for (const id of r.available) slots[id] = 'available'
      for (const id of r.preferred) slots[id] = 'preferred'
      if (r.responseId === null) {
        const resp = { id: uuid(), displayName: r.displayName, noneWork: r.noneWork, revision: 1, createdAt: r.now, updatedAt: r.now, slots, hash: r.editTokenHash }
        e.responses.push(resp)
        return { responseId: resp.id, revision: 1, created: true }
      }
      const resp = e.responses.find((x) => x.id === r.responseId)
      if (!resp || resp.hash !== r.editTokenHash) throw new DbError('forbidden')
      Object.assign(resp, { displayName: r.displayName, noneWork: r.noneWork, slots, revision: resp.revision + 1, updatedAt: r.now })
      return { responseId: resp.id, revision: resp.revision, created: false }
    }),
  }
  return { db, events }
}

function setup(overrides: Partial<Parameters<typeof createHandler>[0]> = {}) {
  const { db, events } = fakeDb()
  const logs: Record<string, unknown>[] = []
  const handle = createHandler({ db, allowedOrigins: [ORIGIN], now: () => NOW, log: (e) => logs.push(e), ...overrides })
  return { handle, db, events, logs }
}

const json = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })

const validEvent = {
  title: '  Study   group ',
  description: null,
  organizerName: 'Priya',
  timezone: 'America/New_York',
  durationMinutes: 60,
  expectedParticipants: null,
  ranges: [{ date: '2027-05-04', start: '09:00', end: '11:00' }],
}

async function createdEvent(s = setup()) {
  const res = await s.handle(json('POST', '/events', validEvent))
  const body = (await res.json()) as { publicId: string; adminToken: string }
  const slots = s.events.get(body.publicId)!.slots
  return { ...s, ...body, slots }
}

describe('POST /events', () => {
  it('validates with the shared domain, stores only a token hash, and returns the token once', async () => {
    const s = setup()
    const res = await s.handle(json('POST', '/events', validEvent))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.publicId).toMatch(/^[A-Za-z0-9]{12}$/)
    expect(body.adminToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const row = vi.mocked(s.db.createEvent).mock.calls[0]![0]
    expect(row.adminTokenHash).toBe(await hashToken(body.adminToken))
    expect(JSON.stringify(row)).not.toContain(body.adminToken)
    expect(row.title).toBe('Study group')
    expect(row.ranges[0]!.slots).toHaveLength(4)
    expect(row.ranges[0]!.startAt).toBe('2027-05-04T13:00:00Z')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('returns schedule issues as 422', async () => {
    const res = await setup().handle(json('POST', '/events', { ...validEvent, ranges: [{ date: '2027-05-01', start: '09:00', end: '11:00' }] }))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'invalid', issues: [{ code: 'date_in_past', date: '2027-05-01' }] })
  })

  it('rejects field problems, bad shapes, bad JSON, wrong content types, and oversized bodies', async () => {
    const { handle, db } = setup()
    expect((await handle(json('POST', '/events', { ...validEvent, title: '   ' }))).status).toBe(422)
    expect((await handle(json('POST', '/events', { ...validEvent, durationMinutes: '60' }))).status).toBe(400)
    expect((await handle(json('POST', '/events', { ...validEvent, ranges: Array(8).fill(validEvent.ranges[0]) }))).status).toBe(400)
    expect((await handle(json('POST', '/events', '{nope'))).status).toBe(400)
    expect((await handle(json('POST', '/events', validEvent, { 'content-type': 'text/plain' }))).status).toBe(415)
    expect((await handle(json('POST', '/events', 'x'.repeat(MAX_BODY_BYTES + 1)))).status).toBe(413)
    expect(db.createEvent).not.toHaveBeenCalled()
  })

  it('retries a public id collision with a fresh id', async () => {
    const ids = ['AAAAAAAAAAAA', 'AAAAAAAAAAAA', 'BBBBBBBBBBBB']
    const s = setup({ newPublicId: () => ids.shift()! })
    expect((await s.handle(json('POST', '/events', validEvent))).status).toBe(201)
    const res = await s.handle(json('POST', '/events', validEvent))
    expect(res.status).toBe(201)
    expect((await res.json()).publicId).toBe('BBBBBBBBBBBB')
  })
})

describe('GET /events/:id', () => {
  it('returns the snapshot without secrets', async () => {
    const { handle, publicId, adminToken } = await createdEvent()
    const res = await handle(new Request(`${BASE}/events/${publicId}`))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(JSON.parse(text).event.title).toBe('Study group')
    expect(text).not.toContain(adminToken)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('404s unknown and malformed ids (malformed ones without touching the database)', async () => {
    const { handle, db } = setup()
    expect((await handle(new Request(`${BASE}/events/NoSuchEvent1`))).status).toBe(404)
    vi.mocked(db.getEvent).mockClear()
    expect((await handle(new Request(`${BASE}/events/bad%20id`))).status).toBe(404)
    expect((await handle(new Request(`${BASE}/events/..%2F..%2Fetc`))).status).toBe(404)
    expect(db.getEvent).not.toHaveBeenCalled()
  })
})

describe('responses', () => {
  it('creates a response with a one-time edit token, then edits it only with that token', async () => {
    const { handle, db, publicId, slots, logs } = await createdEvent()
    const created = await handle(json('POST', `/events/${publicId}/responses`, { displayName: ' Sam ', noneWork: false, availability: { available: [slots[0]], preferred: [slots[1]] } }))
    expect(created.status).toBe(201)
    const { response, editToken } = await created.json()
    expect(editToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(response).toMatchObject({ displayName: 'Sam', slots: { [slots[0]!]: 'available', [slots[1]!]: 'preferred' } })
    expect(vi.mocked(db.submitResponse).mock.calls[0]![0].editTokenHash).toBe(await hashToken(editToken))

    const path = `/events/${publicId}/responses/${response.id}`
    const edit = { displayName: 'Sam', noneWork: true, availability: { available: [], preferred: [] } }
    expect((await handle(json('PUT', path, edit, { authorization: `Bearer ${'x'.repeat(43)}` }))).status).toBe(403)
    const ok = await handle(json('PUT', path, edit, { authorization: `Bearer ${editToken}` }))
    expect(ok.status).toBe(200)
    const okBody = await ok.json()
    expect(okBody.response).toMatchObject({ noneWork: true, revision: 2 })
    expect(okBody.editToken).toBeUndefined()

    // Tokens never appear in logs.
    expect(JSON.stringify(logs)).not.toContain(editToken)
  })

  it('refuses edits without a well-formed bearer token before reading the body or touching the database', async () => {
    const { handle, db, publicId } = await createdEvent()
    const path = `/events/${publicId}/responses/00000000-0000-4000-8000-000000000001`
    for (const authorization of [undefined, 'Bearer short', 'Basic abc', `bearer ${'x'.repeat(43)}`]) {
      const res = await handle(json('PUT', path, '{not even json', authorization ? { authorization } : {}))
      expect(res.status).toBe(403)
    }
    // Malformed response ids are forbidden too (no hint about which ids exist).
    expect((await handle(json('PUT', `/events/${publicId}/responses/not-a-uuid`, {}, { authorization: `Bearer ${'x'.repeat(43)}` }))).status).toBe(403)
    expect(db.submitResponse).not.toHaveBeenCalled()
  })

  it('rejects invalid submissions with 422', async () => {
    const { handle, publicId, slots } = await createdEvent()
    const post = (body: unknown) => handle(json('POST', `/events/${publicId}/responses`, body))
    const avail = (available: string[], preferred: string[] = []) => ({ available, preferred })
    expect((await post({ displayName: 'A', noneWork: false, availability: avail([]) })).status).toBe(422)
    expect((await post({ displayName: 'A', noneWork: true, availability: avail([slots[0]!]) })).status).toBe(422)
    expect((await post({ displayName: 'A', noneWork: false, availability: avail([slots[0]!], [slots[0]!]) })).status).toBe(422)
    expect((await post({ displayName: 'A', noneWork: false, availability: avail(['not-a-uuid']) })).status).toBe(422)
    expect((await post({ displayName: 'A', noneWork: false, availability: avail(['00000000-0000-4000-8000-999999999999']) })).status).toBe(422)
    expect((await post({ displayName: ' ', noneWork: true, availability: avail([]) })).status).toBe(422)
    expect((await post({ displayName: 'A', noneWork: 'yes', availability: avail([]) })).status).toBe(400)
  })

  it('maps database outcomes to HTTP statuses', async () => {
    const { handle, db, publicId } = await createdEvent()
    const body = { displayName: 'A', noneWork: true, availability: { available: [], preferred: [] } }
    for (const [code, status, error] of [
      ['not_found', 404, 'not_found'],
      ['closed', 409, 'conflict'],
      ['limit_reached', 409, 'limit_reached'],
      ['forbidden', 403, 'forbidden'],
    ] as const) {
      vi.mocked(db.submitResponse).mockRejectedValueOnce(new DbError(code))
      const res = await handle(json('POST', `/events/${publicId}/responses`, body))
      expect(res.status).toBe(status)
      expect((await res.json()).error).toBe(error)
    }
  })
})

describe('CORS, routing, and failures', () => {
  it('refuses disallowed browser origins before doing any work', async () => {
    const { handle, db } = setup()
    const res = await handle(json('POST', '/events', validEvent, { origin: 'https://evil.example' }))
    expect(res.status).toBe(403)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(db.createEvent).not.toHaveBeenCalled()
  })

  it('answers preflight for allowed origins and echoes the origin', async () => {
    const { handle } = setup()
    const pre = await handle(new Request(`${BASE}/events`, { method: 'OPTIONS', headers: { origin: ORIGIN } }))
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(pre.headers.get('access-control-allow-headers')).toContain('authorization')
    const res = await handle(json('POST', '/events', validEvent, { origin: ORIGIN }))
    expect(res.status).toBe(201)
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(res.headers.get('vary')).toBe('Origin')
  })

  it('404s unknown paths and 405s wrong methods', async () => {
    const { handle } = setup()
    expect((await handle(new Request(`${BASE}/nope`))).status).toBe(404)
    expect((await handle(new Request(`${BASE}/events`))).status).toBe(405)
    expect((await handle(new Request(`${BASE}/events/AAAAAAAAAAAA`, { method: 'DELETE' }))).status).toBe(405)
    expect((await handle(new Request(`${BASE}/events/AAAAAAAAAAAA/responses`))).status).toBe(405)
  })

  it('hides unexpected errors behind a 503 and logs only the error name', async () => {
    const { handle, db, logs } = setup()
    vi.mocked(db.getEvent).mockRejectedValueOnce(new Error('connection to 10.0.0.5 failed: password=hunter2'))
    const res = await handle(new Request(`${BASE}/events/AAAAAAAAAAAA`))
    expect(res.status).toBe(503)
    const text = await res.text()
    expect(text).not.toContain('hunter2')
    expect(JSON.stringify(logs)).not.toContain('hunter2')
    expect(logs.at(-1)).toMatchObject({ status: 503, error: 'Error' })
  })
})
