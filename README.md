# EverGuide

**Guidance for a Brighter Tomorrow.** AI-assisted career guidance with cited sources, verified mentorship, wellness and financial literacy in one platform.

> Build status and the phase-by-phase log live in [PROGRESS.md](PROGRESS.md). Learning and interview notes for each phase are in [docs/learning/](docs/learning/).

## Repository layout

```
client/     React 19 + Vite + TypeScript (strict) + Tailwind CSS v4 + Radix/shadcn-style UI
shared/     Zod schemas shared by client and server (the API contract)
server/     Express API (Phase 2)
database/   SQL migrations and RLS policies (Phase 2+)
docs/       Architecture, setup, deployment and learning notes
```

npm workspaces tie `client` and `shared` together, so the client imports `@everguide/shared` directly.

## Requirements

- Node.js 22+
- npm 10+

## Getting started

```bash
npm install
cp .env.example client/.env.local   # client values only (VITE_*)
npm run dev                         # http://localhost:5173
```

## Scripts (from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Start the client dev server |
| `npm run build` | Type-check and build the client for production |
| `npm run typecheck` | TypeScript checks in every workspace |
| `npm run lint` | oxlint (fails on warnings) |
| `npm test` | Vitest unit/component tests in every workspace |
| `npm run format` | Prettier |

## Design system

Tokens are CSS variables in [client/src/index.css](client/src/index.css): raw brand colours (`--eg-*`) map to semantic tokens (`--primary`, `--surface`, `--ink`, …), which Tailwind exposes as utilities (`bg-primary`, `text-ink`). Components use only semantic tokens.

Fonts (Bricolage Grotesque for display, Figtree for text) are self-hosted via Fontsource. Motion respects `prefers-reduced-motion`.

The logo in [client/src/components/brand/logo.tsx](client/src/components/brand/logo.tsx) is a **temporary placeholder**. Replace it with the approved asset.

## Configuration

See [.env.example](.env.example) for every variable. Values that are not configured yet (contact email, legal entity, plan prices) live in `client/src/config/` as `null` and show up in the UI as "to be announced". Nothing is invented to fill them.
