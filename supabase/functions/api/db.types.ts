// The database port used by the handler. Implemented with postgres.js in db.ts (Deno) and faked in tests.
import type { GeneratedRange } from '../../../src/domain/schedule.ts'
import type { OverlapEvent, ParticipantResponse } from '../../../src/domain/types.ts'

export interface Snapshot {
  event: OverlapEvent
  responses: ParticipantResponse[]
}

export interface CreateEventRow {
  publicId: string
  title: string
  description: string | null
  organizerName: string
  timezone: string
  durationMinutes: number
  expectedParticipants: number | null
  adminTokenHash: string
  expiresAt: string
  ranges: GeneratedRange[]
  now: string
}

export interface SubmitResponseRow {
  publicId: string
  responseId: string | null
  editTokenHash: string
  displayName: string
  noneWork: boolean
  available: string[]
  preferred: string[]
  now: string
}

export interface Db {
  createEvent(row: CreateEventRow): Promise<void>
  getEvent(publicId: string, now: string): Promise<Snapshot | null>
  submitResponse(row: SubmitResponseRow): Promise<{ responseId: string; revision: number; created: boolean }>
}

/** Codes raised by the SQL functions (see the migration header), plus a duplicate public id. */
export type DbErrorCode = 'not_found' | 'closed' | 'forbidden' | 'limit_reached' | 'invalid' | 'duplicate_public_id'

export class DbError extends Error {
  readonly code: DbErrorCode
  constructor(code: DbErrorCode, message = code) {
    super(message)
    this.name = 'DbError'
    this.code = code
  }
}
