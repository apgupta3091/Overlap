// The Overlap HTTP API. Pure web-standard code (Request → Response) so it runs in the Supabase Edge
// Runtime (index.ts) and in Vitest with a fake database.
//
//   POST /events                              create an event          → 201 { publicId, adminToken }
//   GET  /events/:publicId                    read the snapshot         → 200 { event, responses }
//   POST /events/:publicId/responses          add a response            → 201 { response, editToken }
//   PUT  /events/:publicId/responses/:id      edit a response (Bearer)  → 200 { response }
//
// Security notes:
// - Tokens are 256-bit random secrets returned exactly once, at creation. They travel only in the
//   Authorization header (never in URLs), and only their SHA-256 hashes reach the database.
// - Browser origins must be on the allowlist; other origins are refused before any work is done.
// - Every response is JSON with Cache-Control: no-store. Logs never include bodies, headers, or tokens.
import { z } from 'zod'
import { availabilityPayloadSchema } from '../../../src/domain/availability.ts'
import { checkDescription, checkExpected, checkName, checkTitle, cleanText } from '../../../src/domain/fields.ts'
import { randomId } from '../../../src/domain/ids.ts'
import { LIMITS } from '../../../src/domain/limits.ts'
import { buildSchedule, type ScheduleIssue } from '../../../src/domain/schedule.ts'
import { Temporal } from '../../../src/domain/time.ts'
import { DbError, type Db } from './db.types.ts'
import { bearerToken, generateToken, hashToken } from './tokens.ts'

export const MAX_BODY_BYTES = 32 * 1024

export interface HandlerDeps {
  db: Db
  /** Browser origins allowed to call the API (exact match, e.g. "https://overlap.example"). */
  allowedOrigins: readonly string[]
  now?: () => Temporal.Instant
  newPublicId?: () => string
  newToken?: () => string
  log?: (entry: Record<string, unknown>) => void
}

export type ApiErrorCode =
  | 'bad_request'
  | 'invalid'
  | 'forbidden'
  | 'forbidden_origin'
  | 'not_found'
  | 'method_not_allowed'
  | 'conflict'
  | 'limit_reached'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'unavailable'

class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly issues?: ScheduleIssue[]
  constructor(status: number, code: ApiErrorCode, message: string, issues?: ScheduleIssue[]) {
    super(message)
    this.status = status
    this.code = code
    this.issues = issues
  }
}

const createEventSchema = z.object({
  title: z.string().max(1000),
  description: z.string().max(5000).nullable(),
  organizerName: z.string().max(1000),
  timezone: z.string().max(64),
  durationMinutes: z.number().int(),
  expectedParticipants: z.number().int().nullable(),
  ranges: z.array(z.object({ date: z.string().max(10), start: z.string().max(5), end: z.string().max(5) })).max(LIMITS.maxDates),
})

const responseSchema = z.object({
  displayName: z.string().max(1000),
  noneWork: z.boolean(),
  availability: availabilityPayloadSchema,
})

const PUBLIC_ID = /^[A-Za-z0-9]{10,32}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function baseHeaders(): Headers {
  return new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
}

function corsHeaders(headers: Headers, origin: string | null) {
  headers.set('Vary', 'Origin')
  if (!origin) return
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'authorization, content-type')
  headers.set('Access-Control-Max-Age', '600')
}

/** Route path relative to the function, e.g. "/functions/v1/api/events/x" → ["events", "x"]. */
function routeSegments(url: URL): string[] {
  const parts = url.pathname.split('/').filter(Boolean)
  const i = parts.indexOf('api')
  return i >= 0 ? parts.slice(i + 1) : parts
}

async function readJson(req: Request): Promise<unknown> {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'unsupported_media_type', 'Send JSON with Content-Type: application/json.')
  }
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Request body is too large.')
  const text = await req.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Request body is too large.')
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(400, 'bad_request', 'Request body is not valid JSON.')
  }
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) throw new ApiError(400, 'bad_request', 'Request body has the wrong shape.')
  return result.data
}

function fromDbError(e: DbError, creatingEvent: boolean): ApiError {
  switch (e.code) {
    case 'not_found':
      return new ApiError(404, 'not_found', 'This event doesn’t exist.')
    case 'forbidden':
      return new ApiError(403, 'forbidden', 'You can only edit a response from the browser that submitted it.')
    case 'closed':
      return new ApiError(409, 'conflict', 'This event is no longer collecting availability.')
    case 'limit_reached':
      return new ApiError(409, 'limit_reached', `This event already has ${LIMITS.maxResponses} responses, the maximum.`)
    case 'invalid':
      return creatingEvent
        ? new ApiError(422, 'invalid', 'Some event details aren’t valid. Check the dates and times and try again.')
        : new ApiError(422, 'invalid', 'That availability doesn’t match this event’s times. Reload and try again.')
    case 'duplicate_public_id':
      return new ApiError(503, 'unavailable', 'Please try again.')
  }
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const now = deps.now ?? (() => Temporal.Now.instant())
  const newPublicId = deps.newPublicId ?? (() => randomId(12))
  const newToken = deps.newToken ?? generateToken
  const log = deps.log ?? ((entry) => console.log(JSON.stringify(entry)))
  const allowed = new Set(deps.allowedOrigins)

  async function createEvent(req: Request) {
    const body = parse(createEventSchema, await readJson(req))
    const fieldError =
      checkTitle(body.title) ??
      checkName(body.organizerName, LIMITS.organizerNameMax) ??
      checkDescription(body.description ?? '') ??
      checkExpected(body.expectedParticipants === null ? '' : String(body.expectedParticipants))
    if (fieldError) throw new ApiError(422, 'invalid', fieldError)

    const at = now()
    const schedule = buildSchedule({ timezone: body.timezone, durationMinutes: body.durationMinutes, ranges: body.ranges }, at)
    if (!schedule.ok) throw new ApiError(422, 'invalid', 'Some dates or times need fixing.', schedule.issues)

    const adminToken = newToken()
    const adminTokenHash = await hashToken(adminToken)
    const row = {
      title: cleanText(body.title),
      description: body.description?.trim() || null,
      organizerName: cleanText(body.organizerName),
      timezone: body.timezone,
      durationMinutes: body.durationMinutes,
      expectedParticipants: body.expectedParticipants,
      adminTokenHash,
      expiresAt: schedule.value.expiresAt,
      ranges: schedule.value.ranges,
      now: at.toString(),
    }
    // Public ids are random; retry the (astronomically unlikely) collision a couple of times.
    for (let attempt = 0; ; attempt++) {
      const publicId = newPublicId()
      try {
        await deps.db.createEvent({ ...row, publicId })
        return { status: 201, body: { publicId, adminToken } }
      } catch (e) {
        if (e instanceof DbError && e.code === 'duplicate_public_id' && attempt < 2) continue
        throw e
      }
    }
  }

  async function getEvent(publicId: string) {
    const snapshot = await deps.db.getEvent(publicId, now().toString())
    if (!snapshot) throw new ApiError(404, 'not_found', 'This event doesn’t exist.')
    return { status: 200, body: snapshot }
  }

  async function saveResponse(req: Request, publicId: string, responseId: string | null) {
    // Check the credential before reading the body, so unauthenticated edits do no work.
    let editToken: string
    if (responseId) {
      const token = bearerToken(req.headers.get('authorization'))
      if (!token) throw new ApiError(403, 'forbidden', 'You can only edit a response from the browser that submitted it.')
      editToken = token
    } else {
      editToken = newToken()
    }

    const body = parse(responseSchema, await readJson(req))
    const nameError = checkName(body.displayName)
    if (nameError) throw new ApiError(422, 'invalid', nameError)
    const { available, preferred } = body.availability
    const ids = [...available, ...preferred]
    if (new Set(ids).size !== ids.length) throw new ApiError(422, 'invalid', 'Each time can be marked only once.')
    if (body.noneWork && ids.length > 0) throw new ApiError(422, 'invalid', 'Clear your selected times before choosing “None of these times work”.')
    if (!body.noneWork && ids.length === 0) throw new ApiError(422, 'invalid', 'Mark at least one time, or choose “None of these times work”.')
    if (!ids.every((id) => UUID.test(id))) throw new ApiError(422, 'invalid', 'That availability doesn’t match this event’s times. Reload and try again.')

    const at = now().toString()
    const result = await deps.db.submitResponse({
      publicId,
      responseId,
      editTokenHash: await hashToken(editToken),
      displayName: cleanText(body.displayName),
      noneWork: body.noneWork,
      available,
      preferred,
      now: at,
    })
    const snapshot = await deps.db.getEvent(publicId, at)
    const response = snapshot?.responses.find((r) => r.id === result.responseId)
    if (!response) throw new ApiError(503, 'unavailable', 'Saved, but couldn’t load the result. Reload the page.')
    return result.created ? { status: 201, body: { response, editToken } } : { status: 200, body: { response } }
  }

  async function route(req: Request, segments: string[]) {
    const [root, publicId, sub, responseId, ...rest] = segments
    if (root !== 'events' || rest.length > 0) throw new ApiError(404, 'not_found', 'Not found.')
    if (publicId !== undefined && !PUBLIC_ID.test(publicId)) throw new ApiError(404, 'not_found', 'This event doesn’t exist.')
    const method = req.method

    if (publicId === undefined) {
      if (method === 'POST') return createEvent(req)
      throw new ApiError(405, 'method_not_allowed', 'Method not allowed.')
    }
    if (sub === undefined) {
      if (method === 'GET') return getEvent(publicId)
      throw new ApiError(405, 'method_not_allowed', 'Method not allowed.')
    }
    if (sub !== 'responses') throw new ApiError(404, 'not_found', 'Not found.')
    if (responseId === undefined) {
      if (method === 'POST') return saveResponse(req, publicId, null)
      throw new ApiError(405, 'method_not_allowed', 'Method not allowed.')
    }
    // Unknown or malformed response ids are "forbidden", same as a wrong token: don't reveal which.
    if (method !== 'PUT') throw new ApiError(405, 'method_not_allowed', 'Method not allowed.')
    if (!UUID.test(responseId)) throw new ApiError(403, 'forbidden', 'You can only edit a response from the browser that submitted it.')
    return saveResponse(req, publicId, responseId)
  }

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const segments = routeSegments(url)
    const origin = req.headers.get('origin')
    const headers = baseHeaders()
    const started = Date.now()

    if (origin !== null && !allowed.has(origin)) {
      headers.set('Vary', 'Origin')
      log({ msg: 'request', method: req.method, route: segments[0] ?? '', status: 403, code: 'forbidden_origin' })
      return new Response(JSON.stringify({ error: 'forbidden_origin', message: 'This origin may not call the API.' }), { status: 403, headers })
    }
    corsHeaders(headers, origin)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })

    try {
      const { status, body } = await route(req, segments)
      log({ msg: 'request', method: req.method, route: segments.length > 2 ? 'responses' : segments.length === 2 ? 'event' : 'events', status, ms: Date.now() - started })
      return new Response(JSON.stringify(body), { status, headers })
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : e instanceof DbError
            ? fromDbError(e, req.method === 'POST' && segments.length === 1)
            : new ApiError(503, 'unavailable', 'The service is having trouble. Please try again.')
      log({
        msg: 'request',
        method: req.method,
        status: err.status,
        code: err.code,
        ms: Date.now() - started,
        ...(e instanceof ApiError || e instanceof DbError ? {} : { error: e instanceof Error ? e.name : typeof e }),
      })
      const payload: Record<string, unknown> = { error: err.code, message: err.message }
      if (err.issues) payload.issues = err.issues
      return new Response(JSON.stringify(payload), { status: err.status, headers })
    }
  }
}
