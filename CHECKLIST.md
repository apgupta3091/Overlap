# Overlap — build checklist

Legend: [x] done & verified · [~] partly done · [ ] not started
Plan: 14 chunks, with a review after each. Decisions are in `docs/decisions.md`.

## Week 1 — Local product loop
- [x] **1. Foundation & decisions**
  - [x] Toolchain restored from history, renamed `overlap`; typecheck, test, lint, and build all green
  - [x] Theme tokens: warm neutrals, one accent (#2E5E8C), availability colors and a 6-step heat scale, reduced-motion support
  - [x] Routes: `/`, `/new`, `/e/:publicId`, `/demo`, `/privacy`, not-found (stubs except landing and not-found)
  - [x] `Referrer-Policy: no-referrer` meta set site-wide
  - [x] Decisions D1–D6 recorded; Temporal DST `reject` behavior checked locally
  - [x] Chromium check at 375px and 1280px: no overflow, no console errors
- [x] **2. Time & slot domain**
  - [x] `src/domain/{types,limits,time,schedule}.ts`: shared with the server, pure TS, explicit `.ts` imports
  - [x] Local→UTC conversion via Temporal `disambiguation: 'reject'`, telling nonexistent and ambiguous times apart
  - [x] Range rules: 30-min boundaries, ≤12h, no overnight, `24:00` = end of day, at least the meeting length; each slot must be exactly 30 real minutes, otherwise the range is reported as `crosses_dst`
  - [x] Date rules: 1–7 unique dates, ≤30-day span, not in the past in the *event* timezone, today's range must not have ended
  - [x] Slot generation (global `sortOrder`) and `expiresAt` = last range end + 30 days
  - [x] Plain-language issue messages (`describeIssue`)
  - [x] `src/lib/time/display.ts`: grouping by *display*-timezone date with contiguous segments, time/day labels, IANA name + offset label, browser timezone
  - [x] 31 new unit tests (DST for New York and London, Auckland↔LA date split, Kiritimati range separation); typecheck and lint green
  - [x] Domain code runs and passes `deno check` unchanged (`denoland/deno` Docker image)
- [x] **3. Results & suggestion algorithm** *(awaiting review)*
  - [x] `results.ts`: per-slot tallies (available includes preferred; "none work" = unavailable everywhere), 0–5 heat level, honest wording ("5 of 6", "All" only when true), expected-count wording, labels for duplicate names ("Sam (2)")
  - [x] `windows.ts`: contiguous full-length windows within one range, whole-window attend/prefer scoring, ranking (attendees → preferrers → earliest UTC), greedy non-overlapping top 3, never a window nobody can attend, `findWindow` for manual/server finalize checks; algorithm documented in the file header
  - [x] `availability.ts`: compact payload (`available[]`/`preferred[]`), strict server parse (rejects unknown/cross-event ids, duplicates, conflicts), lenient draft restore, submission rule (≥1 slot, or "none work" with none)
  - [x] 24 new unit tests (61 total); typecheck, lint, and `deno check` green
- [ ] 4. Event creation UI
- [ ] 5. Availability editor (desktop, mobile, keyboard)
- [ ] 6. Results UI & local demo

## Week 2 — Shared persistence
- [ ] 7. Database schema & migrations
- [ ] 8. API (Edge Function) & token security
- [ ] 9. Live client: service layer, credentials, sync
- [ ] 10. Integration tests (security)

## Week 3 — Finalization & launch polish
- [ ] 11. Finalize, reopen, calendar export
- [ ] 12. Lifecycle, limits, abuse controls
- [ ] 13. Error states, accessibility & mobile QA
- [ ] 14. E2E, load test, docs

## Environment
- [x] Node 22.23, npm 10.9, Supabase CLI 3.3.0, Docker running
