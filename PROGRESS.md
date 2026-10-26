# EverGuide — Build Progress

> The project's working memory. Read this first at the start of every session and update it at the end.
> Only record what was actually done and verified. Don't record claimed test passes that were never run.

## Current status

- **Active phase:** Phase 5 (branch `phase-5-wellness-finance-admin`, branched from the Phase 4 tip; the Phase 4 PR is awaiting the user's merge).
- **Last updated:** 2026-10-26
- **Next step:** Phase 5a: migration 4 (wellness, finance, resources, admin analytics) + PGlite tests.

---

## Phase checklist

### Phase 1 — Foundation, Design System & Public Website
- [x] Repo initialized (git, `.gitignore`, `.env.example`, folder layout)
- [x] PROGRESS.md created
- [x] npm workspaces monorepo (`client`, `shared`; `server` joins in Phase 2)
- [x] Vite + React + TS strict client, oxlint + Prettier
- [x] Tailwind + design tokens (colors, type, spacing, radii, shadows, motion, reduced-motion)
- [x] shadcn/ui primitives themed to tokens
- [x] Placeholder logo component
- [x] Layouts: PublicLayout, AuthLayout, AppLayout shell
- [x] Landing page (hero, domains, product preview, how it works, grounded AI, pricing preview, footer)
- [x] Public pages: Features, Pricing, Mentors, Resources, About, Contact, Privacy, Terms
- [x] Router with lazy routes, 404, error boundary
- [x] Unit tests + lint + typecheck + build passing
- [x] Phase wrap-up: explanation, company practices, `docs/learning/phase-1.md`
- [x] Phase 1 quiz with user (2026-10-24: 1/4; revisit design tokens, code splitting, honest-UI reasoning)

### Phase 2 — Backend, Database, Auth & Onboarding
- [x] Express server: env validation, request IDs, pino, helmet, CORS, rate limiting, error handler, `/health` + `/health/ready`, graceful shutdown, request timeouts
- [x] Migrations: profiles, user_preferences, user_roles, audit_events, notifications, contact_messages + RLS (`20261024000001_identity_and_onboarding.sql`, applied 2026-10-24 by the user via the SQL Editor; `npm run db:verify` 26/26 passed)
- [x] Server-side JWT verification (`getClaims`) + DB-backed role checks (`requireRole`)
- [x] API: `POST /contact`, `GET /me`, `PATCH /me/profile`, `PUT /me/onboarding`
- [x] Client auth: register, login, logout, email verification, reset, session, protected routes (+ redirect-after-login, open-redirect protection)
- [x] Onboarding wizard (4 steps, "why we ask" notes, editable later)
- [x] Dashboard (real data + empty states), profile & settings (name, time zone, password, sign out everywhere, account deletion)
- [ ] Dashboard notifications panel (deferred: needs a notifications endpoint; no notifications are produced yet)
- [x] Tests: auth middleware, authorization boundaries (36 server unit tests, 6 real-DB integration tests, 26 RLS checks)
- [x] Phase wrap-up: explanation, company practices, `docs/learning/phase-2.md`
- [x] Phase 2 quiz with user (2026-10-24: 3/4; Phase 2 concepts all correct; code splitting still needs work)

### Phase 3 — AI Guide with RAG
- [x] Migrations: conversations, messages, message_citations, knowledge_documents, knowledge_chunks (pgvector, HNSW), ai_usage (+ atomic `reserve_ai_message`), ai_feedback (`20261024000002_ai_guide.sql`, applied by the user 2026-10-24)
- [x] Ingestion pipeline (Markdown → chunk → embed → store), separate from chat; 10 AI-drafted starter guides, 50 chunks
- [x] Retrieval evaluation (`kb:eval`): hit@1 20/20, MRR 1.0; threshold 0.60 chosen from measured similarities
- [x] Chat API: retrieve → threshold → grounded Gemini streaming (SSE) → only real citations stored
- [x] Safety layer: system-prompt rules, crisis screen with helplines (no model call, no allowance used)
- [x] Workspace UI (history, rename/delete/search, streaming, citations + source panel, copy, retry, stop, feedback, follow-ups, usage); dashboard shows recent conversations and usage
- [x] Server-enforced monthly usage limits (atomic, refunded on failure)
- [x] Tests: citation correctness, conversation isolation, usage limits (91 server unit, 15 integration incl. 8 real-AI, 50 RLS checks)
- [x] Phase wrap-up: explanation, company practices, `docs/learning/phase-3.md`
- [x] Phase 3 quiz with user (2026-10-24: 4/4, incl. code splitting finally understood)

### Phase 4 — Career Studio & Mentor Marketplace
- [x] Roadmap goals + milestones (+ recommended reading via the AI Guide's search)
- [x] Resume analyser (private storage, PDF validation, extraction, structured AI report, deletion; account deletion also removes files)
- [x] Interview practice (32-question bank, saved questions, progress, optional AI feedback)
- [x] Mentor database: profiles, verification states, availability, bookings (exclusion constraints), reviews, booking functions (migration `20261025000003_career_and_mentors.sql`, applied by the user)
- [x] Mentor marketplace API + UI (directory, profiles, booking, sessions, reviews, applications, availability, admin review queue, notifications)
- [x] Tests: booking conflicts, review eligibility, document isolation
- [x] Phase wrap-up: explanation, company practices, `docs/learning/phase-4.md` (quiz 1/4)

### Phase 5 — Wellness, Finance, Resources & Admin Portal
- [ ] Wellness tools (breathing, journal, habits, resources)
- [ ] Finance tools (budget, savings goals, glossary, calculators)
- [ ] Resource library (links + video embeds; Cloudinary deferred)
- [ ] Admin portal (users, mentor verification, content, KB docs, feedback, analytics, audit log)
- [ ] Phase wrap-up ritual

### Phase 6 — Payments, Automation & Production Launch
- [ ] Razorpay subscriptions + verified webhooks + idempotency
- [ ] n8n workflows (signed, deduped, minimal PII)
- [ ] Playwright e2e, accessibility audit, security review
- [ ] Deploy: Vercel (client), Node host (server), Supabase prod
- [ ] Phase wrap-up ritual

---

## Phase log

### Phase 5 (in progress)
- **2026-10-26 (5a database):** Migration `20261026000004_wellness_finance_admin.sql`: journal (writer-only, excluded from admin/analytics/AI), habits + check-ins (composite key to the owner), monthly budgets + items, savings goals with a ledger (`record_savings_entry` locks the goal row, so balances can't go negative), learning resources (published-only for visitors, full-text search via a generated `tsvector` + GIN index, https-only links) + private bookmarks, and server-only admin functions (`admin_overview`, `admin_signups_by_week`, `set_admin_role` with an advisory lock). Money stored as integer paise. **20 new PGlite tests** + a new guard that every `public` table has RLS on; mutation-tested (4 deliberate bugs, all caught). `db:verify` extended with Phase 5 checks (to run after the user applies the migration).
  - Found while writing it: a `current_date` CHECK would break restoring backups (moved to the server); a "keep at least one admin" check was unreachable (the caller must be an admin and can't remove themselves); the `has_role` backlog item had already been done in migration 2.

### Phase 4 — complete (2026-10-25)
- **2026-10-25 (database):** Built an offline test harness: PGlite (Postgres 18 in WebAssembly) + Supabase stubs (`database/test/harness.ts`) runs every migration and tests SQL in seconds without Docker. Migration 3: goals/milestones, resumes (private bucket), interview practice, mentor profiles/verifications/availability, bookings with two exclusion constraints (no mentor or mentee overlaps), reviews, and SECURITY DEFINER booking functions (`mentor_open_slots`, `request_booking`, `respond_to_booking`, `cancel_booking`, `reschedule_booking`, `submit_mentor_review`). Wrapped in `begin/commit`. **29 PGlite tests**, incl. a daylight-saving test (US clocks change 1 Nov 2026) and mutation testing (deleting the overlap constraint or weakening the 12-hour rule makes tests fail). The user applied the migration; `db:verify` extended to **69 checks** on Supabase (btree_gist overlap confirmed via error 23P01, private bucket, direct uploads refused).
- **2026-10-25 (Career Studio):** Roadmap API/UI (`services/career-service.ts`, `pages/career/`); interview practice with a 32-question bank (`database/interview/questions.json`, `npm run interview:seed -w @everguide/server`) and structured AI feedback; resume analyser (`lib/pdf.ts`, `services/resume-service.ts`, raw-body upload after auth). Shared `usage-meter.ts` (one allowance for every AI feature) and `ChatModel.generateJson` with zod validation of model output.
  - **Verified:** typecheck 0, lint clean, 267 unit/DB tests, integration (career 6, interview 6, resumes 6 with real Gemini + Storage), real-browser E2E **12/12** (goal + milestones, optimistic ticking, recommendations, real AI feedback, PDF upload + real report, dashboard progress + usage 2/30, deletion removes the stored file).
  - Bugs caught and fixed: blank starter milestone and empty date blocked goal creation (component tests); CORS didn't allow `X-File-Name`, so uploads failed only in browsers; the milestone checkbox flickered because query-cache updates arrive a tick after the click (now local optimistic state); filter labels gave selects the accessible name "Role All roles"; AI reports guessed the user's gender from their name (prompts now say "you", with a test that rejects gendered pronouns); privacy gap: account deletion didn't remove stored files; a flaky test from the 1 s default async timeout (now 4 s).

- **2026-10-25 (mentor marketplace):** API in `routes/mentors.ts`, `services/mentor-service.ts`, `services/notification-service.ts`: public directory/profile/slots (verified mentors only), mentor application + profile + weekly availability (replace with rollback on failure), booking request/respond/cancel/reschedule/review through the SQL functions (rule errors mapped: P0001→409, P0002→404, 28000→401), admin review queue behind `requireRole('admin')` (decides only still-pending applications, grants the mentor role, notifies, audits), notifications list/mark-read. UI: `/mentors` + `/mentors/:id` (public), `/app/mentors` tabs (Find, My sessions, Mentor profile), `/app/admin/mentors`, notification bell (Radix Popover, 60 s polling).
  - **Verified:** typecheck 0, lint clean, client 110, server 132, database 29, shared 16; integration mentors 9 (real Supabase); real-browser E2E **13/13** with three separate people (apply → admin verifies → availability → mentee books → mentor confirms with link → mentee notified and sees Join; public profile on a phone). Career E2E re-run 12/12.
  - Bugs caught and fixed: passing `api.applyAsMentor` / `api.uploadResume` straight to `mutationFn` leaked TanStack's context object as a second argument (now wrapped, plus a convention test that fails if the pattern returns, checked by reintroducing it); `Date.now()` during render (new `useNow` hook); on phones the booking panel widened the page to 1458 px because a grid item's default `min-width: auto` let the two-week day row stretch it (`minmax(0,1fr)` + `min-w-0`); the "Request sent" banner reappeared on reload because browsers keep history state (now shown once and cleared, with a test confirmed to fail without the fix); first-load JS hit 190 kB (budget 185) because the notification bell's Popover sat in the eagerly loaded app shell; the app shell is now lazy-loaded (177.7 kB).

- **2026-10-25 (user testing):** The user's resume analysis failed twice ("couldn't analyse"). Reproduced with a long synthetic resume: 6/6 runs failed validation, because Gemini returned 8 gaps (limit 6) and suggestions over 400 characters. Our Gemini schema had no limits, and Gemini ignores `maxLength` anyway. Fix: limits live once in `shared` (`RESUME_REPORT_LIMITS`, `INTERVIEW_FEEDBACK_LIMITS`), the model schema gets `maxItems` + length hints (6/6 raw replies then valid), and `fitReport`/`fitFeedback` (`server/src/lib/ai-output.ts`) trim over-long content before strict validation; wrong shapes are still rejected. 8 new tests; resume + interview integration 12/12. Lesson: test AI features with realistic, long inputs, not just short fixtures.

### Phase 3 — complete (2026-10-24)
- **2026-10-24 (workspace UI):** `client/src/lib/sse.ts` (stream parser, handles split events and multi-byte characters), `lib/api.ts` (`streamMessage` + conversation endpoints), `hooks/use-ai.ts`, `pages/guide/` (layout with history sidebar, new-conversation page with starter questions, conversation page, streaming hook, safe Markdown renderer, source panel, composer). The AI Guide route is full-height (`handle.fullBleed`). The dashboard shows recent conversations and an AI usage meter.
  - **Verified:** typecheck, lint, unit tests 186/186 (client 76, server 94, shared 16), integration 15/15, real-browser E2E (Chrome → Vite → API → Gemini + pgvector) **20/20**: grounded answer citing "Budgeting basics", source panel, follow-ups, off-topic marked not grounded, Stop restores the question and refunds, history and titles, reload persistence, feedback, usage 2/30, mobile no overflow, delete. Database left with only the knowledge base.
  - Bugs found by real-browser testing and fixed: (1) Stop re-submitted the question: React reused the button and flipped `type` to submit mid-click; fixed with distinct `key`s. (2) Server kept generating and charging after an early Stop: the disconnect arrived before the `close` listener was attached; now listened for from the first line, and the turn checks cancellation between steps. (3) Follow-ups delayed `done`: now a separate `followups` event, 19.3 s → ~8.5 s. (4) Sidebar title refresh, citation order, and "5 sources" overstating 1 guide.
  - Performance budget fixed: Vite's per-chunk warning missed total growth after code splitting; `client/scripts/check-bundle-size.mjs` now fails the build if first-load JS > 185 kB gzip (currently 175.4 kB). Verified that it fails.
- **2026-10-24 (database):** Migration `20261024000002_ai_guide.sql`. Users can read but never write messages, citations or usage; a composite FK `(conversation_id, user_id)` ties messages to the conversation owner; `reserve_ai_message` takes a per-user advisory lock so concurrent requests can't exceed the limit; only `approved` documents are searchable. `db:verify` now has **50/50** checks, including 10 concurrent reservations against a limit of 3 → exactly 3 granted.
- **2026-10-24 (knowledge base):** 10 AI-drafted guides in `database/knowledge/` (labelled pending expert review), chunked by section (50 chunks). Found that `gemini-embedding-2` merges a batch of texts into ONE embedding; switched to `gemini-embedding-001` (normalised in code) and added a test so a count mismatch can never be stored. Ingestion is idempotent (checksum of model + file). Evaluation: hit@1 20/20, hit@3 20/20, MRR 1.000; correct ≥ 0.670, off-topic ≤ 0.535, so `RAG_MIN_SIMILARITY` = 0.60 (the old default 0.5 would have "grounded" off-topic questions). Caveat: questions were written alongside the guides, so the set is easy.
- **2026-10-24 (chat API):** `server/src/rag/` (safety, prompt, citations, retriever), `lib/gemini.ts` (embedder + streaming chat + JSON follow-ups), `services/ai-store.ts` (repository), `services/ai-guide-service.ts` (turn orchestration: allowance → store question → retrieve → stream → resolve citations → store answer + citations → complete usage; on failure refund and delete), `routes/ai.ts` (SSE). Verified: typecheck, lint, 91/91 unit tests, 15/15 integration tests (8 with real Gemini + pgvector: grounded answer cites "Budgeting basics", off-topic answer not grounded, crisis reply uses no allowance, privacy between users, feedback rules, allowance enforced, deletion). No leftover data.
  - Observed: the free-tier Supabase Auth cold start took 11.4 s and tripped the 10 s client timeout once; it was fine on rerun.

### Phase 2 — complete (2026-10-24)
- **2026-10-24 (client + finish):**
  - Packages: removed `@supabase/ssr` (Next.js-only) and root-level `supabase-js` (user approved). The client uses the standalone `@supabase/auth-js` (browser needs auth only), configured like supabase-js (same URL, headers, storage key). The server uses `@supabase/supabase-js`.
  - Client: `lib/env.ts` (validated VITE_ config, no Zod at startup), `lib/supabase.ts`, `lib/api.ts` (typed API client, `ApiError`, 15s timeout), `lib/safe-redirect.ts`, `auth/` (AuthProvider via `onAuthStateChange`, guards `RequireAuth`/`RequireOnboarding`/`RedirectIfSignedIn`, error messages), pages: login, register (+ check inbox, resend), forgot/reset password, `/auth/callback`, onboarding wizard, dashboard, settings, `/account-deleted`. Contact form now really sends.
  - Server: `DELETE /api/v1/me` (requires `{confirm: "DELETE"}`, writes an audit event, deletes the auth user, data cascades).
  - **Verified:** typecheck 0 errors, oxlint clean, unit tests 111/111 (client 57, server 38, shared 16), integration 7/7 against the real DB, `db:verify` 26/26, production builds OK. **End-to-end browser run (real Chrome → Vite → API → Supabase): 16/16 checks** (guards, wrong-password message, onboarding, dashboard data, reload keeps session, settings save, sign out/in, account deletion). Database left empty afterwards.
  - Bugs found by tests and fixed: sign-out race after account deletion (router transition vs urgent auth update, proven with a router trace); TanStack Query v5 `mutationFn` second argument leaking into API calls; main bundle 741 kB → 546 kB (162 kB gzip) by measuring, removing Zod from startup and switching to `auth-js`; sticky sidebar on long pages.
  - Finding: Supabase rejects `@example.com` signups as invalid, so registration through the form must be tested with a real address.
- **2026-10-24 (server and database):**
- **2026-10-24:** Reviewed the user's Gemini schema (see decisions log). Wrote migration `database/migrations/20261024000001_identity_and_onboarding.sql`: 6 tables, signup trigger, `updated_at` triggers, `has_role()` helper, RLS on every table, column-level grants.
- **2026-10-24:** Supabase dev project created by the user (region chosen by the user). Keys are in `.env` (server) and `client/.env.local` (client), both git-ignored. The user ran the migration in the SQL Editor.
- **2026-10-24 (server):** Built `server/` (Express 5, TypeScript strict).
  - Layout: `src/config/env.ts` (Zod-validated env, fails fast without printing values), `src/lib/` (errors, validation, logger, Supabase clients), `src/middleware/` (auth, errors, rate-limit), `src/routes/` (health, contact, me), `src/services/` (auth, contact, profile), `src/deps.ts` (real dependencies), `src/app.ts` (`createApp(deps)`, dependency injection so tests use fakes).
  - Two Supabase clients: **admin** (secret key; verifying tokens, reading roles, server-only tables) and **user-scoped** (publishable key + user's JWT; RLS still applies on the server, as defence in depth).
  - Shared contracts added: `shared/src/profile.ts` (onboarding/profile schemas, value lists matching the DB CHECKs, `Me` type), `shared/src/api.ts` (error body type).
  - Dev: `tsx watch`. Prod: `server/build.mjs` (esbuild) bundles to `dist/server.js` and inlines `@everguide/shared`. This Node build lacks native TypeScript support, so we don't rely on it.
  - Hand-written `server/src/db/database.types.ts` until Supabase type generation is set up.
  - **Verified:** typecheck 0 errors, oxlint clean, 36/36 unit tests, 6/6 integration tests against the real project (signup trigger, tampered-token rejection, onboarding save, profile update, contact insert), production bundle started and exercised with curl (health, ready, 401, 400, CORS allow/deny). No leftover test users afterwards.
  - Fixes found during verification: auth scheme must be case-insensitive (`bearer` is valid HTTP); logs trimmed to useful fields; friendlier validation messages.
- **2026-10-24:** Added `database/tests/verify-rls.mjs` (`npm run db:verify`): creates 2 temporary users, attempts cross-user reads/writes, privilege escalation, protected-column edits and invalid values, then deletes the users. **Result: 26/26 passed**, run twice.

### Phase 1 — complete (2026-10-24)
**Built**
- Repo on `main`, npm workspaces (`client`, `shared`). `.env.example` has names only.
- Client: Vite 8, React 19, TypeScript 6 strict (+ `noUncheckedIndexedAccess`), Tailwind v4, Radix (`radix-ui`), React Router 8, TanStack Query (provider ready), React Hook Form + Zod 4, lucide-react, self-hosted fonts (Bricolage Grotesque + Figtree).
- Design tokens in `client/src/index.css`: raw `--eg-*` brand vars → semantic vars → Tailwind utilities. Reduced-motion rule. `.container-page` and `.eyebrow` helpers.
- UI primitives in `client/src/components/ui/`: Button (CVA + `asChild`), Input/Textarea/NativeSelect, FormField (auto ARIA wiring), Sheet, Badge.
- Layouts: PublicLayout (sticky header, mobile sheet menu, skip link, footer), AuthLayout (split screen), AppLayout (sidebar + mobile sheet, "preview" notice).
- Landing: hero + original "guidance map" SVG, domains as vertical tabs with honest status badges, AI Guide preview (labelled example content), how it works, source-grounded AI pipeline, mentor verification states, pricing preview, closing CTA.
- Pages: features, pricing (+FAQ), mentors (empty state), resources (empty state), about, contact (RHF + shared Zod; says plainly it isn't sent yet), privacy/terms drafts (draft banner, entity placeholders), login/register (validated; say plainly accounts aren't open), dashboard (empty states only), module placeholders (show the phase each module ships in), 404, router error page.
- Config as data: `client/src/config/` (site, features with status, plans with null prices, app-nav).
- Shared Zod schemas: `shared/src/contact.ts`, `shared/src/auth.ts`.

**Verification actually run (2026-10-24)**
- `npm run typecheck`: 0 errors (client + shared)
- `npm run lint` (oxlint, warnings denied): clean, after fixing an impure `new Date()` call in render in the footer
- `npm test`: client 3 files / 21 tests passed; shared 2 files / 8 tests passed
- `npm run build`: succeeded. Main chunk ~435 kB (136 kB gzip); each page 1–3 kB chunk.
- Headless Chrome screenshots of landing (1440px, 390px) and contact (390px): no horizontal overflow, layout as intended.

**Known gaps (intentional, tracked)**
- Contact / login / register forms validate but don't submit (backend arrives in Phase 2).
- `/app` routes are unprotected previews until Phase 2 auth.
- No CI workflow yet. No dark theme. Logo is a placeholder.

---

## Decisions log

| Date | Decision | Reason | Trade-off |
|---|---|---|---|
| 2026-10-24 | Monorepo with npm workspaces (`client`, `server`, `shared`) | One repo, one install, shared Zod types between front and back | Slightly more config than separate repos |
| 2026-10-24 | Placeholder SVG logo in a single component | Real logo asset not available yet | Must swap in later |
| 2026-10-24 | 6 phases, each ending with tests + learning notes + quiz | User's goal is learning production engineering and interview readiness | Slower than building straight through |
| 2026-10-24 | oxlint instead of ESLint | Official Vite template default; much faster | Smaller plugin ecosystem |
| 2026-10-24 | TypeScript pinned to ~6.0.3 | typescript-eslint and the ecosystem don't support TS 7 yet | Miss TS 7 speedups for now |
| 2026-10-24 | @hookform/resolvers v5 (not v6) | v6 has an upstream peer-dependency conflict; v5 supports Zod 4 | Upgrade later |
| 2026-10-24 | Self-hosted fonts via Fontsource | Privacy, no third-party request, stable layout | Slightly larger build output |
| 2026-10-24 | shadcn-style components hand-written on `radix-ui`, with `components.json` | shadcn is copy-in by design; keeps CLI usable later | — |
| 2026-10-24 | Feature status, plan prices, contact/legal details stored as typed config; unknowns are `null` | Never show invented facts; one place to update | Pages must handle null states |
| 2026-10-24 | Reviewed the user's Gemini schema; adopted its structure with fixes: RLS on every table, roles in a separate `user_roles` table, FK to `auth.users`, NOT NULLs, updated_at triggers, FK indexes, separate private resumes from the global knowledge base, exclusion constraint for bookings, idempotent payment events | The original allowed privilege escalation, cross-user data exposure and double bookings | More tables and policies to maintain |
| 2026-10-24 | Tables are created phase by phase as timestamped SQL migrations in `database/migrations/` | Reviewable, replayable on staging/prod, no unused tables | Can't just click tables together in the dashboard |
| 2026-10-24 | Evolving value lists use text + CHECK; only stable sets (app_role) use Postgres enums | Enum values can't be removed or renamed easily | Slightly less strict typing in the DB |
| 2026-10-24 | Browser talks to Supabase only for auth; all app data goes through the Express API with the user's JWT | One place for validation, rate limits, logging and business rules; RLS stays as a second layer | Extra hop compared with querying Supabase directly |
| 2026-10-24 | Server reads user data with a user-scoped Supabase client, not the service role | A bug in our code still can't cross users (RLS applies) | One client created per request |
| 2026-10-24 | Express 5 | Async errors in handlers reach the error handler automatically | — |
| 2026-10-24 | tsx for dev, esbuild bundle for prod | Local Node lacks native TS support; one-file bundle is simple to deploy | Build step required |
| 2026-10-24 | In-memory rate-limit store | Single instance for now | Must move to a shared store (e.g. Redis) when scaling out |
| 2026-10-24 | Browser uses standalone `@supabase/auth-js`, not supabase-js | Browser needs only auth; saves ~55 kB gzip on every page | Must mirror supabase-js auth configuration ourselves |
| 2026-10-24 | Implicit auth flow (Supabase default), not PKCE | Email links work across devices without custom email templates | PKCE is stricter; revisit with custom templates |
| 2026-10-24 | Route guards perform post-login redirects; pages don't navigate themselves | One place decides where signed-in users go; avoids races | — |
| 2026-10-24 | Account deletion lands on `/account-deleted`, which signs out after rendering | Avoids the guard redirecting to login mid-transition; clearer UX | Extra page |
| 2026-10-24 | Main bundle budget 600 kB (`chunkSizeWarningLimit`) | Current main chunk is framework + auth that every page needs | Raise only after investigating growth |
| 2026-10-24 | Embeddings: gemini-embedding-001, 768 dims, normalised in code | embedding-2 merges batched inputs; 768 fits pgvector HNSW (≤ 2000 dims) | Re-embed everything if the model changes (checksum includes model) |
| 2026-10-24 | Chat: gemini-2.5-flash, thinking off, temperature 0.3 | Stable GA model; fast, low cost; low temperature for grounded answers | Configurable via `GEMINI_CHAT_MODEL` |
| 2026-10-24 | Similarity threshold 0.60 from `kb:eval` | Measured gap between correct (≥ 0.670) and off-topic (≤ 0.535) | Tune with real usage metrics and feedback |
| 2026-10-24 | Answers stream via SSE over a POST with fetch (not EventSource) | EventSource can't send an Authorization header or a POST body | Client parses the stream itself |
| 2026-10-24 | Invalid citation markers are stripped server-side before saving | Every citation shown must map to a retrieved chunk | The streamed text may briefly show a marker that disappears when the answer finishes |
| 2026-10-24 | Keyword-based crisis screen, biased towards false positives | Simple, fast, no model call; missing someone at risk is worse than a false alarm | Needs a classifier and professional review before launch |
| 2026-10-24 | Follow-up suggestions sent as a separate SSE event after `done` | A second model call shouldn't delay the answer | Stream stays open a few seconds longer |
| 2026-10-24 | Answers keep streaming when the user navigates away; only Stop cancels | Better UX; avoids the StrictMode double-mount cancelling the first question | Background work continues until finished |
| 2026-10-24 | Grounding label counts guides, not passages | "5 sources" from one guide overstated the evidence | — |
| 2026-10-24 | Bundle budget on total first-load JS (185 kB gzip), enforced after build | Per-chunk limits miss growth once code is split | Build fails if exceeded |
| 2026-10-25 | PGlite harness for migration tests | Docker unavailable; tests every migration offline in seconds | Not full Supabase; cloud still checked by `db:verify` |
| 2026-10-25 | Booking rules as SECURITY DEFINER functions + exclusion constraints | Atomic, can't be bypassed via the Supabase API, race-proof | Logic lives in SQL; tested in PGlite and on Supabase |
| 2026-10-25 | Resume upload as raw PDF body (not multipart) after auth | Simple, no extra dependency, nothing buffered for anonymous callers | Name sent in a header (`X-File-Name`), so CORS must allow it |
| 2026-10-25 | AI outputs (feedback, reports) are structured JSON validated with zod | Never trust model output's shape | A malformed answer is refunded and shown as a retryable error |
| 2026-10-25 | Admin-only routes enforced on the server (`requireRole` reads `user_roles`); `RequireRole` in the client only hides UI | The client can be edited by anyone; roles in the JWT could be stale | Two places to keep in sync |
| 2026-10-25 | Notifications by polling every 60 s (not realtime) | Simple and cheap at this scale; no websocket infrastructure | Up to a minute's delay; revisit with Supabase Realtime or n8n push in Phase 6 |
| 2026-10-25 | Signed-in app shell lazy-loaded | Public visitors shouldn't download the sidebar and notification code | One extra request when entering `/app` |
| 2026-10-25 | Convention test for `mutationFn: api.x` | A lint rule can't express it; a cheap grep test stops a known bug coming back | Text-based, so it can be fooled by unusual formatting |
| 2026-10-26 | Cloudinary deferred; resources use links and YouTube embeds | No account needed yet; images are optional | Admins can't upload cover images until it's added |
| 2026-10-26 | Journal private via RLS only (no app-level encryption); never shown to admins, analytics or AI | Standard protection, keeps search, no key-loss risk | A full database leak would expose entries; revisit before launch |
| 2026-10-26 | Wellness/finance content AI-drafted and labelled "pending expert review" | Same approach as the knowledge base | Needs expert review before launch |
| 2026-10-24 | Light theme only for now | Focus on one polished theme first; semantic tokens make dark mode a later remap | No dark mode yet |

---

## Configuration needed

| Service | Status | Needed by |
|---|---|---|
| Gemini API key | ✅ Configured in `.env` | Phase 3 |
| Helpline numbers in the crisis response and stress guide (112, Tele-MANAS 14416) | **Verify with an authoritative source** | Before launch |
| Expert review of the AI-drafted knowledge base | Not started | Before launch |
| Custom SMTP for Supabase Auth emails (e.g. Resend, Postmark, SendGrid) | Not configured. Supabase's built-in sender is for testing only (heavily rate-limited) | Before real users |
| Supabase Auth URL configuration (Site URL + redirect URLs) | Set by user for `http://localhost:5173` | Add production URLs at deploy |
| Supabase dev project (URL, publishable key, secret key) | ✅ Configured in `.env` / `client/.env.local`. The Supabase connector in Claude is linked to a different account, so migrations are run by the user in the SQL Editor. | Phase 2 |
| Razorpay (key id/secret, webhook secret, plan IDs) | Not configured | Phase 6 |
| Cloudinary | Deferred (decided 2026-10-26) | Later |
| n8n instance + webhook secret | Not configured | Phase 6 |
| Real logo asset | Not provided (placeholder in use) | Any time |
| Contact email, legal entity name/address for Privacy/Terms | Not provided | Before launch |

---

## Learning focus (from quizzes)
- Phase 1 (1/4): understood server-side validation. Revisit: why design tokens exist (maintainability, not speed); code splitting (performance, not SEO); why unknown facts are `null` (honesty, not a provider rule). Re-checked in Phase 2.
- Phase 2 (3/4): correct on defence in depth (user-scoped client + RLS), account enumeration and 401 vs 503. Missed again: why the main bundle matters (every visitor downloads it; route chunks load on demand; critical path). Ask about it again in Phase 3.
- Phase 3 (4/4): citation validation, measured threshold, race conditions / atomic reservation, and the code-splitting critical path (third attempt) all correct. Next quiz: mix in Phase 2 security concepts as spaced repetition.
- Phase 4 (1/4): correct on the booking race (check-then-insert gap). Missed: DST is why recurring times are stored as local time + IANA zone; client role checks are UX only, the server check is the security (Phase 2 concept); lazy-loading helps because public visitors stop downloading the code, not compression (bundle/critical path again). Re-ask all three in the Phase 5 quiz.

## Open questions / backlog
- Notifications are polled; consider realtime/push (Phase 6). Email copies of booking notifications come with n8n (Phase 6).
- `npm run format:check` flags existing docs/JSON/tsconfig files; decide whether to format them or add a `.prettierignore`.
- Mentor E2E scripts live in the session scratchpad; move them into the repo as Playwright tests in Phase 6.
- Changing the sign-in email address (needs Supabase email-change confirmation flow).
- JWTs stay valid until expiry (~1h) after sign-out/deletion; consider shorter expiry when going live.
- Generate DB types with the Supabase CLI and apply migrations via CI.
- PKCE + custom email templates; captcha on signup/login.
- Pricing for Pro/Premium plans: not decided. The pricing UI reads from config and says "coming soon" until it's set.
