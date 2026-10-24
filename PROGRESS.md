# EverGuide — Build Progress

> The project's working memory. Read this first at the start of every session and update it at the end.
> Only record what was actually done and verified. Don't record claimed test passes that were never run.

## Current status

- **Active phase:** Phase 1 complete (built, verified, quizzed). Waiting for the go-ahead on Phase 2.
- **Last updated:** 2026-10-24
- **Next step:** Phase 2. User creates a Supabase project (URL, anon key, service role key), then build the Express server, migrations, and auth.

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
- [ ] Express server: env validation, request IDs, pino, helmet, CORS, rate limiting, error handler, `/health`
- [ ] Migrations: profiles, user_preferences, user_roles, audit_events, notifications, contact_messages + RLS
- [ ] Server-side JWT verification + DB-backed role checks
- [ ] Client auth: register, login, logout, email verification, reset, session, protected routes
- [ ] Onboarding wizard
- [ ] Dashboard (real data + empty states), profile & settings
- [ ] Tests: auth middleware, authorization boundaries
- [ ] Phase wrap-up ritual

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
| 2026-10-24 | Light theme only for now | Focus on one polished theme first; semantic tokens make dark mode a later remap | No dark mode yet |

---

## Configuration needed

| Service | Status | Needed by |
|---|---|---|
| Gemini API key | Available (user has it) | Phase 3 |
| Supabase project (URL, anon key, service role key) | **Not created yet** | Phase 2 |
| Razorpay (key id/secret, webhook secret, plan IDs) | Not configured | Phase 6 |
| Cloudinary | Not configured | Phase 5 |
| n8n instance + webhook secret | Not configured | Phase 6 |
| Real logo asset | Not provided (placeholder in use) | Any time |
| Contact email, legal entity name/address for Privacy/Terms | Not provided | Before launch |

---

## Learning focus (from quizzes)
- Phase 1 (1/4): understood server-side validation. Revisit: why design tokens exist (maintainability, not speed); code splitting (performance, not SEO); why unknown facts are `null` (honesty, not a provider rule). Re-check these in the Phase 2 quiz.

## Open questions / backlog
- Pricing for Pro/Premium plans: not decided. The pricing UI reads from config and says "coming soon" until it's set.
