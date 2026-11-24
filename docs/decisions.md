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
- **Plan:** Chunk 8 tries a relative import of `src/domain` from the function first. If local serve or deploy rejects it, a `scripts/sync-shared.mjs` copies `src/domain` into `supabase/functions/_shared/domain`, and CI checks the copy is in sync. Either way there's one source of truth.

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
