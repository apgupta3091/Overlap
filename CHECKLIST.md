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
- [ ] 2. Time & slot domain
- [ ] 3. Results & suggestion algorithm
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
