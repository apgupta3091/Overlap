// End-to-end smoke test against a running local stack (npm run api:start, then npm run api:smoke).
// Exercises the real Edge Function + Postgres: create → read → respond → edit, plus the main refusals.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const API = process.env.API_URL ?? 'http://127.0.0.1:54321/functions/v1/api'
const ORIGIN = 'http://localhost:5173'
let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` ${extra}`}`)
  if (!ok) failures++
}
async function call(method, path, body, headers = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, json, headers: res.headers }
}
const psql = (q) => execFileSync('docker', ['exec', '-i', 'supabase_db_overlap', 'psql', '-U', 'postgres', '-d', 'postgres', '-qtA', '-c', q]).toString().trim()

// Tomorrow and the day after, in New York.
const ny = (d) => new Date(Date.now() + d * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const created = await call('POST', '/events', {
  title: 'Smoke test',
  description: 'Bring snacks',
  organizerName: 'Priya',
  timezone: 'America/New_York',
  durationMinutes: 60,
  expectedParticipants: 4,
  ranges: [
    { date: ny(1), start: '09:00', end: '11:00' },
    { date: ny(2), start: '18:00', end: '20:00' },
  ],
}, { origin: ORIGIN })
check('create event → 201', created.status === 201, JSON.stringify(created.json))
// The local Kong gateway rewrites this header to "*"; production should echo the origin (verify at deploy).
const acao = created.headers.get('access-control-allow-origin')
check('allowed origin gets a CORS header', acao === ORIGIN || acao === '*', String(acao))
const { publicId, adminToken } = created.json

const snap = await call('GET', `/events/${publicId}`)
check('read event → 200 with 8 slots', snap.status === 200 && snap.json.event.slots.length === 8, JSON.stringify(snap.json)?.slice(0, 200))
check('snapshot has no secrets', !JSON.stringify(snap.json).includes(adminToken) && !/hash/i.test(JSON.stringify(snap.json)))
check('no-store caching', snap.headers.get('cache-control') === 'no-store')
const slots = snap.json.event.slots.map((s) => s.id)

const r1 = await call('POST', `/events/${publicId}/responses`, { displayName: 'Sam', noneWork: false, availability: { available: [slots[0], slots[1]], preferred: [slots[2]] } })
check('add response → 201 with edit token', r1.status === 201 && /^[A-Za-z0-9_-]{43}$/.test(r1.json?.editToken ?? ''), JSON.stringify(r1.json))
const { response, editToken } = r1.json
check('response round-trips availability', response.slots[slots[2]] === 'preferred' && Object.keys(response.slots).length === 3)

const edit = { displayName: 'Samantha', noneWork: false, availability: { available: [slots[4]], preferred: [] } }
const bad = await call('PUT', `/events/${publicId}/responses/${response.id}`, edit, { authorization: `Bearer ${'A'.repeat(43)}` })
check('edit with wrong token → 403', bad.status === 403)
const none = await call('PUT', `/events/${publicId}/responses/${response.id}`, edit)
check('edit with no token → 403', none.status === 403)
const ok = await call('PUT', `/events/${publicId}/responses/${response.id}`, edit, { authorization: `Bearer ${editToken}` })
check('edit with the right token → 200, revision 2', ok.status === 200 && ok.json.response.revision === 2 && ok.json.response.displayName === 'Samantha', JSON.stringify(ok.json))

const r2 = await call('POST', `/events/${publicId}/responses`, { displayName: 'Ben', noneWork: true, availability: { available: [], preferred: [] } })
const cross = await call('PUT', `/events/${publicId}/responses/${r2.json.response.id}`, edit, { authorization: `Bearer ${editToken}` })
check("one person's token can't edit another's response", cross.status === 403)

// Another event's slot can't be used here.
const other = await call('POST', '/events', { title: 'Other', description: null, organizerName: 'X', timezone: 'UTC', durationMinutes: 30, expectedParticipants: null, ranges: [{ date: ny(1), start: '12:00', end: '13:00' }] })
const otherSlots = (await call('GET', `/events/${other.json.publicId}`)).json.event.slots.map((s) => s.id)
const foreign = await call('POST', `/events/${publicId}/responses`, { displayName: 'Eve', noneWork: false, availability: { available: [otherSlots[0]], preferred: [] } })
check('slots from another event → 422', foreign.status === 422, JSON.stringify(foreign.json))

const past = await call('POST', '/events', { title: 'Past', description: null, organizerName: 'X', timezone: 'UTC', durationMinutes: 30, expectedParticipants: null, ranges: [{ date: '2020-01-01', start: '12:00', end: '13:00' }] })
check('past dates → 422 with schedule issues', past.status === 422 && past.json.issues?.[0]?.code === 'date_in_past', JSON.stringify(past.json))

const evil = await call('POST', '/events', {}, { origin: 'https://evil.example' })
check('disallowed origin → 403', evil.status === 403)
check('unknown event → 404', (await call('GET', '/events/NoSuchEvent00')).status === 404)

// Only hashes in the database.
const stored = psql(`select encode(admin_token_hash, 'hex') from overlap.events where public_id = '${publicId}'`)
check('database stores SHA-256 of the admin token', stored === createHash('sha256').update(adminToken).digest('hex'))
const dump = psql(`select coalesce(string_agg(t::text, ''), '') from (select e::text as t from overlap.events e union all select r::text from overlap.responses r) x`)
check('no raw token anywhere in the tables', !dump.includes(adminToken) && !dump.includes(editToken))

// Logs never contain tokens.
const logs = execFileSync('docker', ['logs', 'supabase_edge_runtime_overlap'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
check('function logs contain no tokens', !logs.includes(adminToken) && !logs.includes(editToken))

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
