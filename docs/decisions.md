# Technical decisions

Each entry records what was checked, when, and against which source. Re-verify anything older than a few months before relying on it.

## D1 — Date/time library: `temporal-polyfill` (pinned 1.0.8)
*Checked 2026-11-24 (npm registry; package README/FullCalendar docs).*

- **Why Temporal:** `PlainDateTime.toZonedDateTime(tz, { disambiguation: 'reject' })` throws `RangeError` for nonexistent (spring-forward) and ambiguous (fall-back) local times. That is exactly the spec's DST rule ("reject, explain, never silently shift"). Instants, zoned times, and plain dates are separate types, so we never compute offsets by hand.
- **Verified locally:** `America/New_York` 2027-03-14 02:30 → RangeError, 2027-11-07 01:30 → RangeError, 01:30 on 2027-03-14 → 06:30Z. Importing from `temporal-polyfill` doesn't install a global (`globalThis.Temporal` stays undefined).
- **Why this polyfill:** it's actively maintained (published Nov 2026), spec-compliant, and smaller than `@js-temporal/polyfill` (last published Mar 2025). FullCalendar v7 depends on it.
- **Rejected:** Luxon. It's mature, but DST gaps shift silently, so detection would have to be built by hand. date-fns + @date-fns/tz has the same issue.
- **Runtime support:** Node 22 (Vitest) has no native Temporal, which is why we use the polyfill. Deno imports it as `npm:temporal-polyfill@1.0.8`.
- **Timezone data** comes from the runtime's Intl (ICU), so results can differ slightly across browser versions when tz rules change.

## D2 — Calendar export: hand-rolled ICS serializer
*Checked 2026-11-24.* We emit a single VEVENT with UTC times only, so the RFC 5545 work is limited to TEXT escaping, CRLF, and 75-octet folding. That's about 60 lines with direct unit tests, compared with adding a dependency like `ics` (3.12.1) plus its schema dependency. Revisit if we add VTIMEZONE or recurrence.

## D3 — Code shared between client and Edge Function
- `src/domain/**` is pure TypeScript: no DOM, no React, no Vite-only APIs. Relative imports use explicit `.ts` extensions (`allowImportingTsExtensions` is on), and the only bare imports allowed are `temporal-polyfill` and `zod`. Deno can then load these files unchanged, with an import map (`deno.json`) for the two npm packages.
- Supabase documents `supabase/functions/_shared` as the standard location for shared code. Its changelog (Feb 2025) says imports from outside `supabase/` are supported at deploy time, but community reports show `functions serve` failing on them locally.
- **Verified 2026-11-24:** `src/domain/schedule.ts` runs and passes `deno check` unchanged with a `deno.json` import map (`temporal-polyfill` → `npm:temporal-polyfill@1.0.8`).
- **Verified 2026-11-24 (Chunk 8, local):** the Edge Runtime (supabase-edge-runtime 1.79.3, Deno 2.1.4) compiles and runs `supabase/functions/api` importing `../../../src/domain/*.ts` directly. `deno check` passes in `denoland/deno:2.1.4`. **Still to verify at first deploy (Chunk 14):** that `supabase functions deploy` bundles files outside `supabase/`.
- **Fallback plan (if deploy rejects it):** Chunk 8 tries a relative import of `src/domain` from the function first. If local serve or deploy rejects it, a `scripts/sync-shared.mjs` copies `src/domain` into `supabase/functions/_shared/domain`, and CI checks the copy is in sync. Either way there's one source of truth.

## D4 — Backend: Supabase (Postgres + one Edge Function), free plan
*Checked 2026-11-24 at supabase.com/pricing and /docs/guides/functions/limits.*

| Free-plan item | Limit |
|---|---|
| Database size | 500 MB per project |
| Edge Function invocations | 500,000 / month |
| Edge Function CPU time | 2 s per request (async I/O excluded); 150 s wall clock; 256 MB memory |
| Egress | 5 GB / month |
| Active projects | 2 |
| Inactivity | project **paused after 1 week of inactivity** |
| Backups | **none included** on Free |

The first limits we're likely to hit are **pausing after a quiet week** and **invocations from polling**. One open tab polling every 25 s makes about 144 calls an hour, so roughly 3,400 tab-hours of open event pages per month would use the whole quota. Polling stops in hidden tabs. Capacity notes are completed in Chunk 14.

The client calls the Edge Function with `fetch`. `@supabase/supabase-js` is **not** a client dependency, because the browser never talks to the tables.

## D5 — Static hosting (tentative; decide in Chunk 14, deploy only with approval)
*Checked 2026-11-24 using third-party comparisons only. Official terms must be re-verified before deploying.*
- **Cloudflare Pages** is the leading candidate: commercial use is allowed on the free plan, static bandwidth isn't metered, and it supports `_headers` (Referrer-Policy, X-Robots-Tag) and SPA fallback.
- Netlify free also allows commercial use, but it moved to credit-based limits in 2025.
- Vercel Hobby is non-commercial only, so it's excluded for a public launch.

## D6 — Toolchain (reused from the previous project in this repo)
React 19, Vite 8, TypeScript 7 (strict, `noUncheckedIndexedAccess`), Tailwind 4, React Router 8, TanStack Query 5, React Hook Form + Zod 4, Vitest 5 + Testing Library, Playwright, and oxlint. UI primitives (Button, Dialog with focus trap, Field, States, Toast) were adapted from commit `e9773a6`.

## D7 — Week 1 runs on a local service with the API's contract
*Decided 2026-11-24.* The UI talks to an `EventService` interface (`src/data/service.ts`): `createEvent`, `getEvent`, `createResponse`, `updateResponse`. Until the Edge Function exists, `LocalEventService` implements it on top of `localStorage`. It enforces the same rules the server will: `buildSchedule`, field limits, strict `parseAvailability`, `checkSubmission`, the 50-response cap, and edit tokens. That way the UI is built against realistic errors. Chunk 9 adds a live implementation behind the same interface.
- **Consequence:** in this build an event only opens in the browser that created it. The share panel and the not-found page say so plainly.
- The demo uses the same service over an in-memory store, seeded through the real schedule code, so it exercises the same paths and resets on reload.
- Credentials (admin token, response id + edit token) and availability drafts are stored per event under `overlap:cred:*` / `overlap:draft:*`. Local tokens are stored as-is; the server stores only hashes (Chunk 8).
- The creation and response forms use plain React state instead of React Hook Form. Date rows are dynamic and validated by `buildSchedule` as a whole, and RHF added complexity without much benefit here.

## D8 — Database access: private schema, direct connection, SQL functions for writes
*Decided 2026-11-24.*
- All tables live in the `overlap` schema. It is **not** in `[api] schemas`, and `anon`/`authenticated` have no usage, table, or function privileges. RLS is on with no policies. pgTAP checks all of this, and a mutation run (granting anon access) confirmed those tests fail when access is wrong.
- The Edge Function connects directly to Postgres with postgres.js and `SUPABASE_DB_URL`, not through PostgREST/supabase-js. **Verified locally (Chunk 8):** the variable is injected (`supabase_db_overlap:5432`, user `postgres`). `npm:postgres` (3.4.7 and 4.1.1) fails in the Edge Runtime with `Not implemented: LibuvStreamWrap.prototype.useUserBuffer`. The Deno-native build (`https://deno.land/x/postgresjs@v3.4.7/mod.js`, pinned in `deno.json` and locked in `deno.lock`) works. We use `prepare: false` so the transaction pooler works. **At deploy:** confirm what production `SUPABASE_DB_URL` points to (direct or pooler).
- Writes that must be atomic are SQL functions:
  - `create_event` inserts the event, ranges, and slots from the `buildSchedule` output and re-checks tiling and expiry.
  - `submit_response` creates or edits a response. It takes a `FOR UPDATE` lock on the event row, so the 50-response cap holds: 60 concurrent submits gave exactly 50 rows.
  - `get_event` returns the sanitized snapshot in the exact domain shape.
  - `delete_expired_events` is scheduled in Chunk 12.
  Functions raise `P0001` with a machine-readable message (`not_found`, `closed`, `forbidden`, `limit_reached`, `invalid`).
- The database stores only SHA-256 hashes of admin and edit tokens; raw tokens never reach it.
- `events.revision` increments on every response write, so Chunk 9 can poll cheaply.
- Constraints repeat the invariants that must never break, even if the function has a bug: label trimming and length, durations, 30-minute slots, ≤12h ranges, quarter-hour UTC boundaries (Nepal +05:45 local half-hours fall on :15/:45 UTC), and composite foreign keys so a response can only reference slots of its own event.

## D9 — API shape and token security (Chunk 8)
*Decided 2026-11-24.* One Edge Function, `api`, with `verify_jwt = false`: the app has no accounts, so Supabase JWTs don't apply.
- **Routes:** `POST /events` → `{ publicId, adminToken }`; `GET /events/:publicId` → snapshot; `POST /events/:publicId/responses` → `{ response, editToken }`; `PUT /events/:publicId/responses/:id` with `Authorization: Bearer <editToken>` → `{ response }`.
- **Tokens:** 256-bit CSPRNG secrets, base64url-encoded (43 chars). They're returned only once, at creation, and travel only in the `Authorization` header, never in URLs. The database stores only SHA-256 hashes. Malformed tokens and response ids are refused (403) before the body is read or the database is touched. An unknown response id gets the same 403 as a wrong token, so the API doesn't reveal which ids exist.
- **Validation:** request shape is checked with zod (400), then the shared domain rules (`buildSchedule`, field checks), with schedule issues returned as 422. The SQL functions check again as a backstop.
- **Origins:** browser requests from origins outside `ALLOWED_ORIGINS` get 403 before any work is done. Requests without an `Origin` header (server-to-server, curl) are allowed, because the tokens are what protect the data. Locally, Kong's CORS plugin answers preflight requests and rewrites `Access-Control-Allow-Origin` to `*`. Harmless, since no cookies are used, but the production header must be verified at deploy.
- **Responses:** always JSON with `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. Bodies are capped at 32 KB (413), and non-JSON is refused (415).
- **Errors** map to the client's codes: `invalid` 422, `not_found` 404, `forbidden` 403, `conflict` 409 (event closed), `limit_reached` 409, `unavailable` 503. Unexpected errors return a generic 503. Logs record method, status, code, and timing; for unexpected errors they also record the error's class name. They never include bodies, headers, tokens, or error messages.
- **Public ids** are 12 base62 characters (~71 bits), with retry on collision.
- Rate limiting and abuse controls come in Chunk 12.
