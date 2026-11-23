# Shortlist — build checklist

Legend: [x] done & verified · [~] partly done · [ ] not started

## Part 0 — Environment
- [x] Homebrew, Node 22, Supabase CLI, OrbStack installed
- [ ] OrbStack first-run setup (needed for local Supabase in Part 3)

## Part 1 — Foundation
- [x] Vite + React 19 + TS (strict) + Tailwind 4 + React Router 8 + TanStack Query + RHF/Zod + Vitest + Playwright
- [x] Domain types, cents math, cost calculations, URL validation/normalization, votes, filters, compare limit
- [x] Listing/board form schemas (Zod)
- [x] 73 unit tests passing
- [x] Repository interface, error translation, query hooks (optimistic vote/status with rollback)
- [x] Demo fixtures (8 fictional listings, 3 fictional roommates) + original SVG illustrations
- [x] Demo repository (localStorage, memory fallback, reset)
- [x] Theme, UI primitives (Button, fields, accessible Dialog, toasts, states)
- [x] Landing page, demo board, not-found page, `.env.example`
- [x] Verified in Chromium: no console errors, no horizontal overflow at 320/375px, vote set/clear persists, 4th compare selection disabled

## Part 2 — Local product loop
- [ ] Add/edit listing form (fast add + details, duplicate URL warning)
- [ ] Photo picker (resize, re-encode, preview, progress)
- [ ] Listing detail page (gallery, pricing, amenities, votes, status, tour, notes, delete)
- [ ] Comparison page
- [ ] Board settings (demo variant), JSON export
- [ ] Component tests (fast-add validation, vote rollback, empty states, compare with missing data)
- [ ] Mobile: collapse filters behind a toggle

## Part 3 — Persistence & auth
- [ ] Migrations, RLS, RPCs; auth flows; Supabase repository; board dashboard

## Part 4 — Collaboration & images
- [ ] Invites, members, storage uploads/cleanup, access-control integration tests

## Part 5 — Launch readiness
- [ ] Accessibility/mobile pass, E2E tests, docs, free-tier review
