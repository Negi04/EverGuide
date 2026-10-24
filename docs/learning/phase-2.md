# Phase 2: Backend, Database, Auth & Onboarding

## 60-second pitch (say this in an interview)

> "In Phase 2 I made EverGuide a real multi-user application. The database is Supabase Postgres, and every table has Row Level Security, so the database itself enforces that users can only see and change their own rows. Column-level grants stop them editing protected fields like their role. I reviewed an AI-generated schema for this and found a privilege-escalation hole and a cross-user data leak through the RAG design, and fixed both before writing any code. The backend is an Express 5 API in TypeScript with validated configuration, structured logs with request IDs, security headers, a CORS allow-list, rate limits and one consistent error format. It verifies Supabase login tokens on the server and reads user data *as that user*, so the database security still applies even if my code has a bug. On the frontend I built the full account lifecycle: register, email verification, login, password reset, onboarding, settings and real account deletion. I tested it at three levels: 111 unit tests, 7 API tests against the real database and a 26-check security test, and a browser end-to-end run of the whole user journey. Those tests caught three real bugs before any user would have seen them."

## What we built

| Area | What | Where |
|---|---|---|
| Database | 6 tables, signup trigger, `updated_at` triggers, RLS on every table, column grants | `database/migrations/20261024000001_identity_and_onboarding.sql` |
| DB security test | 2 temporary users try to attack each other; 26 checks | `database/tests/verify-rls.mjs` (`npm run db:verify`) |
| API | Express 5: config, logging, errors, rate limits, auth, 7 endpoints | `server/src/` |
| Contracts | Zod schemas shared by browser and server | `shared/src/` |
| Auth UI | Register, verify email, login, forgot/reset password, guards | `client/src/pages/auth/`, `client/src/auth/` |
| Product UI | Onboarding wizard, dashboard with real data, settings, account deletion | `client/src/pages/onboarding/`, `client/src/pages/app/` |

## How a request flows (draw this on a whiteboard)

```
Browser ──(email + password)──▶ Supabase Auth ──▶ access token (JWT, ~1 hour)
Browser ──(Authorization: Bearer <JWT>)──▶ Express API
   Express: rate limit → validate JWT (getClaims) → validate body (Zod) → service
   Service: Supabase client *as the user* ──▶ Postgres (RLS: user_id = auth.uid())
```

## Key concepts, explained

**1. Authentication vs authorization.** Authentication answers "who are you?" (Supabase Auth issues a signed JWT). Authorization answers "what may you do?" (RLS policies, column grants, `requireRole`). Interviewers love this distinction.

**2. JWT.** A signed token containing claims such as `sub` (user ID), `role` and `exp` (expiry). The server checks the signature and expiry, so it can trust the user ID without a database lookup. Downside: a JWT can't be revoked before it expires. After account deletion, the old token technically stays valid for up to an hour, but there's no account left for it to act on.

**3. Row Level Security (RLS).** Postgres policies like `using (id = auth.uid())` filter every query. Without RLS, Supabase's public API key would let anyone read every table. RLS decides **which rows**; column grants (`grant update (full_name) …`) decide **which columns**.

**4. Defence in depth.** The server reads user data with the *user's* token, not the all-powerful secret key. So even if a route had a bug that asked for someone else's row, the database would return nothing. The secret (service-role) key is used only where the server has already authorised the action.

**5. Mass assignment.** If an endpoint saved `req.body` directly, a user could send `{"role": "admin"}`. Zod schemas strip unknown keys, and the user ID always comes from the verified token, never from the request body. Tests prove both.

**6. Account enumeration.** "No account with that email" tells attackers which emails are registered. Our forgot-password page always answers neutrally, and Supabase's signup does the same.

**7. Open redirect.** `/login?redirect=https://evil.example` could bounce a freshly logged-in user to a phishing page. `safeRedirect()` only allows paths on our own site.

**8. CORS is not security for your API.** It stops *browsers* on other sites from reading responses. `curl` ignores it completely. Real protection comes from authentication and authorization.

**9. 401 vs 403 vs 503.** 401 = we don't know who you are. 403 = we know, and the answer is no. 503 = a dependency is down. We return 503 (not 401) when Supabase is unreachable, so users aren't told their session expired when it didn't.

**10. Liveness vs readiness.** `/health` = the process is alive (restart it if not). `/health/ready` = it can do real work, because the database is reachable (send it traffic).

**11. Structured logging + request IDs.** Every log line is JSON with a request ID, which is also returned in the `X-Request-Id` header and in error bodies. A user's error report can be matched to the exact log line. Authorization headers are redacted.

**12. Dependency injection for testing.** `createApp(deps)` receives its services. Unit tests pass fakes (fast, no network), and integration tests pass the real Supabase-backed services (`createDeps`).

**13. The test pyramid.** Many fast unit tests (111), fewer integration tests against the real database (7 + 26 RLS checks), and one end-to-end browser run of the full journey (16 checks). Each level catches different bugs.

## Bugs the tests caught (great interview stories)

1. **Sign-out race condition.** After deleting their account, users landed on the login page instead of a confirmation. React Router applies navigation as a low-priority transition, so the urgent sign-out rendered first, while the old protected page and its guard were still mounted. I proved this with a router state trace, then fixed it with a confirmation page that signs out *after* it renders.
2. **Library contract change.** TanStack Query v5 passes a second argument to `mutationFn`. Passing API functions directly leaked an unexpected argument. I now wrap them so only the intended input passes.
3. **Bearer scheme case.** HTTP says `bearer` and `Bearer` are equivalent. My first regex, and a test I wrote, wrongly rejected lowercase. Reviewing the test against the RFC caught it.
4. **Bundle size.** The main bundle grew to 741 kB. I measured it, removed Zod from startup code and swapped supabase-js for the standalone auth client: 546 kB (162 kB gzipped). Then I set an explicit budget so future growth is noticed.

## Trade-offs

- **API in front of Supabase** (instead of the browser querying tables directly): one place for validation, rate limits and logging. Costs an extra network hop.
- **Implicit auth flow, not PKCE.** Email links work even when opened on a different device. PKCE is stricter but needs custom email templates. A candidate for hardening.
- **In-memory rate limiting.** Fine for one server; needs Redis or similar with multiple instances.
- **Hand-written DB types.** Until the Supabase CLI is linked; generated types are the production practice.

## How companies do this

- **Auth is bought, not built.** Teams use Auth0, Cognito, Clerk or Supabase Auth. Hand-rolled password storage is a classic source of breaches.
- **Security review for auth changes.** Changes to RLS, roles or token handling usually need a second reviewer from a security-minded engineer, plus automated policy tests like our `db:verify`.
- **Migrations through CI.** Migrations are reviewed in PRs and applied automatically to staging, then production, never by hand-editing a live database.
- **Observability.** JSON logs ship to Datadog, Grafana Loki or CloudWatch. Request IDs connect frontend errors, API logs and database queries.
- **Three test layers.** Unit tests run on every commit. Integration tests run against an ephemeral database in CI. End-to-end tests run on preview deployments before release.
- **On-call and status codes.** Correct 401/403/503 split matters because alerts fire on 5xx rates, and mislabelled errors wake people up at night.

## Likely interview questions

**Q: How do you stop one user reading another's data?**
A: Three layers. The user ID comes only from the verified JWT. Queries run as that user, so Postgres RLS filters rows. And tests that attack it: two real users trying to read and modify each other's data.

**Q: Why not just check permissions in the API?**
A: I do. But RLS means a single forgotten `where user_id = …` can't leak data, and it also protects any client that talks to Supabase directly.

**Q: How do you handle roles?**
A: Roles live in a separate `user_roles` table that users can read but never write. `requireRole` checks the database on each request rather than trusting the token or the client.

**Q: What happens when a JWT is stolen?**
A: It works until it expires (about an hour), which is why tokens are short-lived and refresh tokens can be revoked ("sign out on all devices"). Further hardening: shorter expiry, refresh-token rotation, and binding sessions to devices.

**Q: Describe a hard bug you fixed.**
A: The sign-out race condition above. Explain how you measured it (router state trace), the root cause (transition vs urgent update), and why the fix is structural, not a timeout.

## What I'd improve next
- Generated Supabase types and migrations applied through the Supabase CLI in CI.
- Custom SMTP (Resend, Postmark or SendGrid) so verification emails reach real users.
- Notifications endpoint and a dashboard notifications panel.
- PKCE flow with custom email templates; captcha on signup and login.
- Move the end-to-end browser test into the repo with Playwright (Phase 6).
