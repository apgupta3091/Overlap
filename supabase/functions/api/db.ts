// postgres.js adapter for the handler's Db port. Uses the Deno-native build of postgres.js: the npm
// build fails in the Edge Runtime (Deno 2.1) with "LibuvStreamWrap.prototype.useUserBuffer" (D8).
import postgres from 'postgres'
import { DbError, type Db, type Snapshot } from './db.types.ts'

const SQL_FUNCTION_CODES = new Set(['not_found', 'closed', 'forbidden', 'limit_reached', 'invalid'])

/** Map Postgres errors to domain codes. Anything unexpected is rethrown (→ 503, logged by name only). */
function mapError(e: unknown): never {
  const err = e as { code?: string; message?: string; constraint_name?: string }
  if (err?.code === 'P0001' && err.message && SQL_FUNCTION_CODES.has(err.message)) throw new DbError(err.message as never)
  if (err?.code === '23505' && err.constraint_name === 'events_public_id_key') throw new DbError('duplicate_public_id')
  // Constraint (23xxx) or data (22xxx) violations mean input slipped past validation: treat as invalid.
  if (err?.code?.startsWith('23') || err?.code?.startsWith('22')) throw new DbError('invalid')
  throw e
}

export function createPgDb(url: string): Db {
  // prepare:false keeps us compatible with Supavisor's transaction pooler.
  // Note: pass objects to jsonb parameters via sql.json(); JSON.stringify would double-encode.
  const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 })

  return {
    async createEvent(r) {
      try {
        await sql`
          select overlap.create_event(
            ${r.publicId}::text, ${r.title}::text, ${r.description}::text, ${r.organizerName}::text, ${r.timezone}::text,
            ${r.durationMinutes}::int, ${r.expectedParticipants}::int, decode(${r.adminTokenHash}::text, 'hex'),
            ${r.expiresAt}::timestamptz, ${sql.json(r.ranges as never)}::jsonb, ${r.now}::timestamptz)`
      } catch (e) {
        mapError(e)
      }
    },

    async getEvent(publicId, now) {
      try {
        const rows = await sql`select overlap.get_event(${publicId}::text, ${now}::timestamptz) as snapshot`
        const value = rows[0]?.snapshot
        if (value === null || value === undefined) return null
        return (typeof value === 'string' ? JSON.parse(value) : value) as Snapshot
      } catch (e) {
        mapError(e)
      }
    },

    async submitResponse(r) {
      try {
        const rows = await sql`
          select response_id, response_revision, created from overlap.submit_response(
            ${r.publicId}::text, ${r.responseId}::uuid, decode(${r.editTokenHash}::text, 'hex'), ${r.displayName}::text,
            ${r.noneWork}::boolean,
            array(select jsonb_array_elements_text(${sql.json(r.available)}::jsonb)::uuid),
            array(select jsonb_array_elements_text(${sql.json(r.preferred)}::jsonb)::uuid),
            ${r.now}::timestamptz)`
        const row = rows[0]!
        return { responseId: String(row.response_id), revision: Number(row.response_revision), created: Boolean(row.created) }
      } catch (e) {
        mapError(e)
      }
    },
  }
}
