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
- [x] **3. Results & suggestion algorithm** *(reviewed)*
  - [x] `results.ts`: per-slot tallies (available includes preferred; "none work" = unavailable everywhere), 0–5 heat level, honest wording ("5 of 6", "All" only when true), expected-count wording, labels for duplicate names ("Sam (2)")
  - [x] `windows.ts`: contiguous full-length windows within one range, whole-window attend/prefer scoring, ranking (attendees → preferrers → earliest UTC), greedy non-overlapping top 3, never a window nobody can attend, `findWindow` for manual/server finalize checks; algorithm documented in the file header
  - [x] `availability.ts`: compact payload (`available[]`/`preferred[]`), strict server parse (rejects unknown/cross-event ids, duplicates, conflicts), lenient draft restore, submission rule (≥1 slot, or "none work" with none)
  - [x] 24 new unit tests (61 total); typecheck, lint, and `deno check` green
- [x] **4. Event creation UI** *(awaiting review)*
  - [x] `/new`: title, organizer name, description (optional, counter), meeting length, expected count (optional), timezone (browser default; IANA list with offsets)
  - [x] Date rows: up to 7, each with a date + half-hour From/Until (`24:00` = end of day); "Add another date" uses the next day with the same times; remove a row
  - [x] Validation through `buildSchedule`: problems appear on the matching date row, whole-schedule problems below; field errors show inline after the first submit and focus moves to the first invalid field; live "N dates, M half-hour slots" summary
  - [x] Data layer: `EventService` contract plus `LocalEventService`, which enforces the server's rules (D7); credentials and drafts per event; TanStack Query hooks
  - [x] After creating, you land on `/e/:id` with a share panel (selectable link + copy) that honestly says the link is local-only for now
- [x] **5. Availability editor** *(awaiting review)*
  - [x] Day × time table in the *display* timezone (`lib/time/grid.ts`): empty cells where there's no slot, gaps marked, repeated fall-back hours get their own row
  - [x] Mouse/pen: press and drag to paint (the first cell decides add or clear). Touch: tap, so the page still scrolls. Keyboard: one tab stop, arrows/Home/End/Ctrl+Home/End, Space/Enter toggles
  - [x] Available/Preferred mode, "Clear all", "None of these times work" (disables the grid but keeps your marks), selection summary, and a warning when no marked stretch covers a full meeting
  - [x] Draft autosave per event with restore + discard; editing your submitted response from the same browser (edit token); sticky submit bar on mobile
  - [x] Never color alone: check and star icons, plus full accessible names ("Wednesday, November 25, 4:00 – 4:30 PM: preferred")
- [x] **6. Results UI & local demo** *(awaiting review)*
  - [x] Response count (with expected count), top-3 non-overlapping suggestions with attendance wording, prefer count, who can't make it, and "Show on grid" highlighting
  - [x] Heatmap: counts in every cell, preferred marker, legend; selecting a cell shows Prefer / Available / Can't make it names; participant list with "(you)" and duplicate-name labels
  - [x] Display-timezone switcher for both views (browser and event timezones pinned first); cross-midnight ranges read "11:00 PM – 12:00 AM (next day)"
  - [x] `/demo`: in-memory event with 5 responses (one "none work") built relative to today; visitors can add themselves and see the results update; reload resets
  - [x] 24 new tests (85 total), including full UI flows (create → respond → results → edit, keyboard, drafts, demo); typecheck, lint, and build green
  - [x] Chromium at 375px and 1280px: no horizontal overflow and no console errors on `/new`, `/e/:id`, `/demo`. Verified drag paint/clear, click, and keyboard in a real browser
  - [ ] Follow-up for Chunk 14: JS bundle is 557 kB min / 172 kB gzip (Temporal polyfill + zod); code-split the routes

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
