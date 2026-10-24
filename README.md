# EverGuide

**Guidance for a Brighter Tomorrow.** AI-assisted career guidance with cited sources, verified mentorship, wellness and financial literacy in one platform.

> Build status and the phase-by-phase log live in [PROGRESS.md](PROGRESS.md). Learning and interview notes for each phase are in [docs/learning/](docs/learning/).

## Repository layout

```
client/     React 19 + Vite + TypeScript (strict) + Tailwind CSS v4 + Radix/shadcn-style UI
shared/     Zod schemas shared by client and server (the API contract)
server/     Express 5 REST API (TypeScript, pino, helmet, rate limiting, Supabase)
database/   SQL migrations, RLS policies and database security tests
docs/       Architecture, setup, deployment and learning notes
```

npm workspaces tie the packages together, so both client and server import `@everguide/shared` directly.

## Requirements

- Node.js 22+
- npm 10+

## Getting started

```bash
npm install
cp .env.example .env                # server values (secret — never commit)
cp .env.example client/.env.local   # keep only the VITE_* lines here
npm run dev                         # client: http://localhost:5173
npm run dev:api                     # API:    http://localhost:4000/health
```

### Database

Migrations live in `database/migrations/` and are applied in filename order (Supabase SQL Editor, or `supabase db push` once the CLI is linked). After applying, run:

```bash
npm run db:verify   # creates 2 temporary users, attempts cross-user access, then deletes them
```

## Scripts (from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Start the client dev server |
| `npm run dev:api` | Start the API with auto-reload (reads `.env`) |
| `npm run build` | Type-check and build the client for production |
| `npm run typecheck` | TypeScript checks in every workspace |
| `npm run lint` | oxlint (fails on warnings) |
| `npm test` | Vitest unit/component tests in every workspace (no network) |
| `npm run test:integration` | API tests against the real Supabase project in `.env` |
| `npm run db:verify` | Row Level Security regression test against the database |
| `npm run format` | Prettier |

## API

Base path `/api/v1`. Every error has the shape `{ "error": { "code", "message", "requestId", "details?" } }`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | — | Liveness |
| GET | `/health/ready` | — | Readiness (database reachable) |
| POST | `/api/v1/contact` | — | Contact form (5 per hour per IP) |
| GET | `/api/v1/me` | Bearer | Profile, roles, onboarding answers |
| PATCH | `/api/v1/me/profile` | Bearer | Update name / time zone |
| PUT | `/api/v1/me/onboarding` | Bearer | Save onboarding answers |
| DELETE | `/api/v1/me` | Bearer | Delete the account (body `{"confirm":"DELETE"}`) |
| GET | `/api/v1/conversations?q=` | Bearer | List or search the user's AI Guide conversations |
| POST | `/api/v1/conversations` | Bearer | Start a conversation (`{"domain"}`) |
| GET / PATCH / DELETE | `/api/v1/conversations/:id` | Bearer | Read with messages and citations / rename / delete |
| POST | `/api/v1/conversations/:id/messages` | Bearer | Ask a question; the answer **streams as server-sent events** (`start`, `delta`, `done`, `error`) |
| PUT | `/api/v1/messages/:id/feedback` | Bearer | Rate an AI answer |
| GET | `/api/v1/ai/usage` | Bearer | AI answers used this month and the limit |

Production build: `npm run build -w @everguide/server` bundles the server into `server/dist/server.js` (run with `node dist/server.js`).

## AI Guide (RAG)

Knowledge documents live in `database/knowledge/*.md` (front matter + Markdown). The pipeline:

1. `npm run kb:ingest -w @everguide/server`: chunk each document by section, embed with Gemini (768 dims), store in pgvector. Unchanged documents are skipped.
2. `npm run kb:eval -w @everguide/server`: retrieval quality (hit@1, hit@3, MRR) on `database/knowledge/eval-questions.json`, and the similarity gap used to set `RAG_MIN_SIMILARITY`.
3. At question time the API embeds the question, retrieves approved chunks above the threshold, asks Gemini to answer only from those numbered sources, streams the answer, and stores only citations that match retrieved sources.

The starter documents are AI-drafted and **must be reviewed or replaced before real users**.

## Authentication

Supabase Auth runs in the browser (`@supabase/auth-js`); the API verifies the access token on every request and reads data as that user, so Row Level Security still applies. In the Supabase dashboard set **Authentication → URL Configuration**: Site URL `http://localhost:5173` and redirect URL `http://localhost:5173/**` (add production URLs at deploy). Supabase's built-in email sender is for testing only; configure custom SMTP before inviting real users.

## Design system

Tokens are CSS variables in [client/src/index.css](client/src/index.css): raw brand colours (`--eg-*`) map to semantic tokens (`--primary`, `--surface`, `--ink`, …), which Tailwind exposes as utilities (`bg-primary`, `text-ink`). Components use only semantic tokens.

Fonts (Bricolage Grotesque for display, Figtree for text) are self-hosted via Fontsource. Motion respects `prefers-reduced-motion`.

The logo in [client/src/components/brand/logo.tsx](client/src/components/brand/logo.tsx) is a **temporary placeholder**. Replace it with the approved asset.

## Configuration

See [.env.example](.env.example) for every variable. Values that are not configured yet (contact email, legal entity, plan prices) live in `client/src/config/` as `null` and show up in the UI as "to be announced". Nothing is invented to fill them.
