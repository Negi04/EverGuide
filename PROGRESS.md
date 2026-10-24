# EverGuide — Build Progress

> The project's working memory. Read this first at the start of every session and update it at the end.
> Only record what was actually done and verified. Don't record claimed test passes that were never run.

## Current status

- **Active phase:** Phase 2 complete (built and verified on branch `phase-2-backend`). Wrap-up quiz in progress.
- **Last updated:** 2026-10-24
- **Next step:** Phase 3 (AI Guide with RAG). Before starting: the user adds `GEMINI_API_KEY` to `.env`. Before real users: configure custom SMTP in Supabase.

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
- [ ] Phase 2 quiz with user

### Phase 3 — AI Guide with RAG
- [ ] Migrations: conversations, messages, knowledge_documents, knowledge_chunks (pgvector), ai_usage, ai_feedback
- [ ] Ingestion pipeline (extract → chunk → embed → store), separate from chat
- [ ] Chat API: retrieve → threshold → grounded Gemini streaming → real citations
- [ ] Safety layer (disclaimers, crisis escalation)
- [ ] Workspace UI (history, rename/delete/search, citations, copy, retry, feedback)
- [ ] Server-enforced usage limits
- [ ] Tests: citation correctness, conversation isolation, usage limits
- [ ] Phase wrap-up ritual

### Phase 4 — Career Studio & Mentor Marketplace
- [ ] Roadmap goals + milestones
- [ ] Resume analyzer (private storage, PDF validation, extraction, analysis, deletion)
- [ ] Interview prep
- [ ] Mentor profiles, verification states, availability, bookings (no overlaps), reviews
- [ ] Tests: booking conflicts, review eligibility, document isolation
- [ ] Phase wrap-up ritual

### Phase 5 — Wellness, Finance, Resources & Admin Portal
- [ ] Wellness tools (breathing, journal, habits, resources)
- [ ] Finance tools (budget, savings goals, glossary, calculators)
- [ ] Resource library + Cloudinary
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
| 2026-10-24 | Light theme only for now | Focus on one polished theme first; semantic tokens make dark mode a later remap | No dark mode yet |

---

## Configuration needed

| Service | Status | Needed by |
|---|---|---|
| Gemini API key | User has it; **not yet in `.env`** (`GEMINI_API_KEY` empty) | Phase 3 |
| Custom SMTP for Supabase Auth emails (e.g. Resend, Postmark, SendGrid) | Not configured. Supabase's built-in sender is for testing only (heavily rate-limited) | Before real users |
| Supabase Auth URL configuration (Site URL + redirect URLs) | Set by user for `http://localhost:5173` | Add production URLs at deploy |
| Supabase dev project (URL, publishable key, secret key) | ✅ Configured in `.env` / `client/.env.local`. The Supabase connector in Claude is linked to a different account, so migrations are run by the user in the SQL Editor. | Phase 2 |
| Razorpay (key id/secret, webhook secret, plan IDs) | Not configured | Phase 6 |
| Cloudinary | Not configured | Phase 5 |
| n8n instance + webhook secret | Not configured | Phase 6 |
| Real logo asset | Not provided (placeholder in use) | Any time |
| Contact email, legal entity name/address for Privacy/Terms | Not provided | Before launch |

---

## Learning focus (from quizzes)
- Phase 1 (1/4): understood server-side validation. Revisit: why design tokens exist (maintainability, not speed); code splitting (performance, not SEO); why unknown facts are `null` (honesty, not a provider rule). Re-check these in the Phase 2 quiz.

## Open questions / backlog
- Dashboard notifications panel + `GET /me/notifications` (nothing produces notifications until Phase 4/6).
- Changing the sign-in email address (needs Supabase email-change confirmation flow).
- JWTs stay valid until expiry (~1h) after sign-out/deletion; consider shorter expiry when going live.
- Generate DB types with the Supabase CLI and apply migrations via CI.
- PKCE + custom email templates; captcha on signup/login.
- Next migration: `revoke execute on function public.has_role from public, anon` (harmless today, since it returns false for anonymous callers, but tighter).
- Pricing for Pro/Premium plans: not decided. The pricing UI reads from config and says "coming soon" until it's set.
