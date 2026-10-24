# Phase 1: Foundation, Design System & Public Website

## 60-second pitch (say this in an interview)

> "I started EverGuide by setting up a TypeScript monorepo with npm workspaces: a React + Vite client and a `shared` package of Zod schemas, so the frontend and the future Express backend validate data against the same contract. I built a design system on CSS variables with two layers: raw brand colours, and semantic tokens like `primary` and `surface` that Tailwind exposes as utilities. That means a rebrand or dark mode is a change in one file. The public site is a set of lazy-loaded routes, so every page ships as its own small JavaScript chunk, with a router-level error boundary and a 404. Product facts like feature availability, plan prices and contact details come from typed config files, and anything we don't know yet is `null` and shown as 'to be announced', so the site never makes claims we can't back up. I covered it with 29 automated tests, including tests that check the UI never claims a message was sent when the backend doesn't exist yet, and every check runs as lint, typecheck, test and build."

## What we built

| Area | What | Key files |
|---|---|---|
| Monorepo | npm workspaces: `client`, `shared` (server joins in Phase 2) | `package.json` |
| Tooling | TypeScript 6 strict + `noUncheckedIndexedAccess`, oxlint, Prettier, Vitest | `client/tsconfig.app.json`, `client/vite.config.ts` |
| Design tokens | Brand → semantic CSS variables, Tailwind v4 `@theme`, reduced motion | `client/src/index.css` |
| UI primitives | Button (variants via CVA, `asChild` via Radix Slot), inputs, accessible FormField, Sheet (Radix Dialog), Badge | `client/src/components/ui/` |
| Layouts | Public (header/footer, skip link), Auth (split screen), App shell (sidebar + mobile sheet) | `client/src/components/layout/` |
| Pages | Landing (8 sections), Features, Pricing, Mentors, Resources, About, Contact, Privacy, Terms, Login, Register, Dashboard, module placeholders, 404, error page | `client/src/pages/` |
| Config as data | Feature status, plans, navigation, site/legal details | `client/src/config/` |
| Shared contracts | Zod schemas for contact, login, register | `shared/src/` |

## Key concepts, explained

**1. Design tokens (two layers).** `--eg-blue-600: #2563EB` is a *raw* token. `--primary: var(--eg-blue-600)` is a *semantic* token. Components only use semantic ones (`bg-primary`). If the brand changes, or you add dark mode, you remap semantic tokens without touching components. This is how design systems like GitHub Primer and Shopify Polaris work.

**2. Code splitting with lazy routes.** Each route uses `lazy: () => import('./page')`. Vite emits a separate file per page, so a visitor to `/pricing` doesn't download the contact form's validation code. The landing page is loaded eagerly because it's the most common entry point and we don't want a loading flash there.

**3. Error boundaries.** In React, a crash during render unmounts the whole tree, leaving a white screen. The router's `errorElement` catches render errors and failed lazy imports (common right after a deploy, when old chunk files disappear) and shows a recovery screen.

**4. One schema, two places.** `registerSchema` in `shared/` gives the form instant client-side validation through React Hook Form. In Phase 2 the server validates with the *same* schema, because client validation is only for user experience: anyone can bypass it with `curl`.

**5. Accessibility built in, not bolted on.** Semantic landmarks (`header`/`nav`/`main`/`footer`), a skip link, visible `:focus-visible` outlines, `FormField` that wires `aria-invalid` + `aria-describedby` automatically, Radix primitives for keyboard-correct tabs and dialogs, and `prefers-reduced-motion` support.

**6. Honest UI.** Feature statuses (`available` / `in-development` / `planned`) are data. Plan prices are `null` until decided. Forms that can't send yet say so. A test asserts this, so a later change can't quietly make the UI lie.

## Trade-offs we made

- **oxlint instead of ESLint.** The official Vite template now ships oxlint (written in Rust, much faster). It has fewer plugins than ESLint, which we accepted to stay on the official default.
- **TypeScript 6.0, not 7.** typescript-eslint and much of the ecosystem don't support TS 7 yet. Pinning to `~6.0.3` avoids being an early adopter on a production project.
- **`@hookform/resolvers` v5, not v6.** v6 has an upstream peer-dependency conflict. v5 fully supports Zod 4.
- **Self-hosted fonts.** Fontsource bundles the font files with the app: no request to Google, so better privacy and no layout shift from a third-party domain.
- **shadcn *style*, written by hand.** shadcn/ui is "copy the code into your repo" by design. We followed its conventions (`components.json`, `cn()`, CVA variants, Radix) so `npx shadcn add` works later.

## How companies do this

- **Design system team or owner.** Tokens and primitives are owned by one group and reviewed carefully, because every product team depends on them. Changes go through design review plus a visual regression tool like Chromatic or Percy.
- **Branch → PR → review → merge.** Nobody pushes straight to `main`. Each change is a pull request with a description, screenshots for UI work, and at least one reviewer's approval. CI must pass first.
- **CI pipeline.** On every PR, GitHub Actions (or similar) runs exactly what we ran: lint → typecheck → test → build. Preview deployments (Vercel does this automatically) give reviewers a live URL per PR.
- **Tickets.** Work is split into tickets in Jira or Linear (our PROGRESS.md checklist plays this role). A ticket has acceptance criteria, like our "Done when" lines.
- **Feature flags and honest states.** Unfinished features ship hidden behind flags or clearly labelled, never as fake functionality.
- **Conventional commits.** Commit messages like `feat:`, `fix:`, `test:` make changelogs and releases automatic.

## Likely interview questions

**Q: Why a monorepo?**
A: The client and server share types and validation. In one repo, a contract change and both of its consumers land in a single PR and are tested together. The trade-off is more tooling configuration and coupled CI.

**Q: Why validate on the client if the server validates anyway?**
A: Different goals. Client validation gives instant feedback and saves round trips. Server validation is the security boundary, because client code can be bypassed. Sharing one Zod schema keeps the two from drifting apart.

**Q: How did you make the site accessible?**
A: Semantic HTML landmarks, a skip link, visible focus styles, labels tied to inputs with errors announced through `aria-describedby` and `role="alert"`, Radix primitives for keyboard-correct tabs and dialogs, and reduced-motion support. Tests query by accessible role and label, so a broken label fails a test.

**Q: What's code splitting and how did you measure it?**
A: Splitting the JavaScript bundle so each route loads only what it needs. The build output showed each page as its own 1–3 kB chunk, and the form libraries landing in a separate chunk loaded only on form pages.

**Q: What would you do differently or next?**
A: Add a CI workflow, visual regression tests, Lighthouse budgets in CI, a dark theme on top of the semantic tokens, and swap in the real logo.

## What I'd improve next
- GitHub Actions CI running lint/typecheck/test/build on every PR.
- Lighthouse/axe automated checks.
- Reduce the main bundle (~136 kB gzipped) by lazy-loading Radix-heavy layout parts.
