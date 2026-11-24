// Edge Function entry point: wires the handler to Postgres and the environment.
import { createPgDb } from './db.ts'
import { createHandler } from './handler.ts'

const dbUrl = Deno.env.get('SUPABASE_DB_URL')
if (!dbUrl) throw new Error('SUPABASE_DB_URL is not set')

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

Deno.serve(createHandler({ db: createPgDb(dbUrl), allowedOrigins }))
