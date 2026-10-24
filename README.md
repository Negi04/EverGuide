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

Production build: `npm run build -w @everguide/server` bundles the server into `server/dist/server.js` (run with `node dist/server.js`).

## Design system

Tokens are CSS variables in [client/src/index.css](client/src/index.css): raw brand colours (`--eg-*`) map to semantic tokens (`--primary`, `--surface`, `--ink`, …), which Tailwind exposes as utilities (`bg-primary`, `text-ink`). Components use only semantic tokens.

Fonts (Bricolage Grotesque for display, Figtree for text) are self-hosted via Fontsource. Motion respects `prefers-reduced-motion`.

The logo in [client/src/components/brand/logo.tsx](client/src/components/brand/logo.tsx) is a **temporary placeholder**. Replace it with the approved asset.

## Configuration

See [.env.example](.env.example) for every variable. Values that are not configured yet (contact email, legal entity, plan prices) live in `client/src/config/` as `null` and show up in the UI as "to be announced". Nothing is invented to fill them.
