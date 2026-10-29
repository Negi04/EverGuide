# EverGuide security review

Reviewed 2026-10-29, at the end of Phase 6. EverGuide is a college project: payments run
in Razorpay Test Mode and emails go to a local test inbox. This review covers the code
and the Supabase project as they are now. Deployment isn't covered yet.

Each control below names the test or check that shows it works. **"Open"** marks a known
gap that is accepted for now.

## What we protect

| Asset                                                                      | Why it matters                                                 |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Accounts and sessions                                                      | Someone taking over an account sees that person's private data |
| Journal entries, resumes, budgets, savings                                 | Personal and sensitive; only their owner may read them         |
| Roles (admin, verified mentor)                                             | An admin can change other people's roles and content           |
| Payments and plans                                                         | A plan must only switch on after a real (test) payment         |
| API keys (Supabase service role, Gemini, Razorpay, Cloudinary, n8n secret) | Each gives wide access to a service or to all data             |

## Who might attack, and how

- **A signed-in user** reading or changing someone else's data, or giving themselves admin
  or a paid plan.
- **An anonymous visitor** calling the API directly instead of using the website.
- **Someone faking events** to our Razorpay webhook or to n8n.
- **Injected script (XSS)** running in a user's browser and stealing their session.
- **Accidental leaks:** secrets committed to git, or personal data kept longer than needed.

## Controls

### Authentication and authorization

- **Login:** Supabase Auth handles sign-in. The server checks each access token with
  Supabase on every request. Tested in `server/test/me.test.ts` and `require-role.test.ts`.
- **Database rules:** Row Level Security is on for **every** table, and a test fails if
  any public table lacks it (`database/test/migrations.test.ts`).
  - Column grants limit what users may write. A user can't set their own role,
    verification status, plan or payment state (`database/test/*.test.ts`, including
    `billing.test.ts`).
- **Roles:** admin is checked in the database on every admin request, never taken from
  the browser (`require-role.test.ts`, the e2e test "people who are not admins cannot
  open the admin area").
- **Service role key:** used only on the server, and only after the server has decided
  the caller is allowed.

### Input and output

- **Validation:** every request body and query string goes through a Zod schema. Unknown
  fields are rejected where it matters, for example the browser can't send a price
  (`billing-routes.test.ts`).
- **Size limits:** JSON bodies are capped at 100 kB, and resume PDFs are checked for type,
  size and magic bytes.
- **Error responses** have one fixed shape. Internal details stay in the server logs
  (`security.test.ts`).
- **AI output** is shown as text, never as HTML. Citations must point to passages that
  were actually retrieved.

### Payments (demo)

- **Test Mode only:** the server refuses to start with Razorpay live keys (`env.test.ts`).
- **Price:** set on the server from one table; the browser sends only "pro" or "premium".
- **Checkout:** a plan switches on only after the server verifies Razorpay's HMAC-SHA256
  signature, compared in constant time, and only for the person who created the order.
- **Webhook:** signed over the raw body, and deduplicated by event id.
- **No double grants:** the order row is locked, so the checkout callback and the webhook
  together still grant exactly one month (`database/test/billing.test.ts`).

### Automation (n8n)

- **What events contain:** ids, first names, times and plan names. No email addresses,
  booking topics, journal text or payment details.
- **Signatures:** every event is signed as HMAC-SHA256 over `timestamp.body`. n8n rejects
  bad signatures and anything older than 5 minutes, so a captured request can't be
  replayed later. Tested in `n8n-workflow.test.ts` and against a real n8n.
- **Retention (added in 6c, migration 8):**
  - Deleting an account, or a booking, deletes the events that mention it.
  - Delivered events are deleted after 30 days, failed ones after 90.
  - Tested in `database/test/outbox.test.ts`.

### Browser

- **Content Security Policy (added in 6c, production build):** scripts may come only
  from EverGuide itself, one inline theme script allowed by its exact hash, and
  Razorpay. Connections may go only to our API, Supabase, Cloudinary and Razorpay.
  Frames may come only from YouTube's no-cookie domain and Razorpay.
  - Verified by running the browser tests against the production build: any blocked
    resource fails the test.
- **API headers:** the API sends helmet's headers: CSP, HSTS, `nosniff`, `X-Frame-Options`
  and `Referrer-Policy: no-referrer`.
- **CORS:** allows only the configured website origin (`security.test.ts`).
- **Embeds:** YouTube videos use `youtube-nocookie.com`. Images are delivered by
  Cloudinary at fixed sizes.

### Abuse

- **Rate limits:** on the whole API, plus tighter ones for contact, AI answers, resume
  uploads, bookings, checkout and webhooks (`security.test.ts`).
- **AI allowance:** a monthly allowance per user, reserved atomically in the database so
  parallel requests can't exceed it.
- **Bookings:** overlapping bookings are impossible even under race conditions (a Postgres
  exclusion constraint).

### Secrets and dependencies

- **Git:** only `.env.example` has ever been committed. A scan of all history for key
  patterns found test placeholders only, and none of the real keys appears anywhere
  (checked 2026-10-29).
- **Dependencies:** `npm audit` found 0 known vulnerabilities, in runtime and dev
  dependencies alike (2026-10-29).
- **Error messages:** configuration errors name the variable, never its value
  (`env.test.ts`).

## Open items (accepted for now)

1. **frame-ancestors:** a `<meta>` CSP can't stop other sites from framing EverGuide. Send
   the same policy as an HTTP header, including `frame-ancestors 'none'`, when deploying.
2. **Sessions after sign-out:** a signed-out or deleted user's access token stays valid
   until it expires (about an hour). Shorten the JWT expiry before a real launch.
3. **Bots:** there is no captcha on sign-up or login, and email templates are Supabase's
   defaults.
4. **Cloudinary:** images from a cancelled form can stay in Cloudinary until a cleanup job
   exists. Strict transformations aren't on yet, so anyone can request new image sizes
   on our quota.
5. **Savings entries:** deleting one is checked in the server, not locked in SQL. Two
   deletes at the same moment could take a person's _own_ goal below zero; nobody else's
   data is affected.
6. **Admin user list:** it reads up to 10,000 accounts and filters them in memory. Move
   to server-side search before that scale.
7. **Before going live:** Razorpay live keys, a real email provider and a real inbox
   would each need their own review. These are out of scope for the demo.
