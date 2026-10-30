# Phase 6: Demo payments, automation and hardening

## Start here: Phase 6 in plain words

If everything feels like a lot, read only this section first. Each point is one idea.

1. **Payments are a rehearsal.** Razorpay's Test Mode works like the real thing, but no
   money moves. The server refuses to start with real ("live") keys, so a mistake can't
   charge anyone.
2. **The browser never decides the price.** It only says "Pro" or "Premium"; the server
   looks up the price itself. Otherwise anyone could edit the page and pay ₹1.
3. **A plan switches on only after a signature check.** Razorpay signs each payment with a
   secret only Razorpay and our server know. A faked "payment succeeded" message has no
   valid signature, so it's refused.
4. **Doing it twice must be harmless.** The same payment can be reported twice (by the
   browser and by Razorpay's webhook). The database locks the order, so it still gives
   exactly one month. This is called _idempotency_.
5. **Emails come from events written in the same step as the change.** When a booking is
   confirmed, the database writes "booking confirmed" in the same transaction. That's
   the _outbox_: no change without its event, and no event without its change.
6. **If n8n is down, nothing is lost.** The server keeps retrying, waiting longer each
   time (30 s, 1 min, 2 min…). An event might be sent twice, so each carries a fixed id
   and n8n skips repeats.
7. **Keep the least personal data, for the shortest time.** Events carry first names and
   ids only. Deleting an account deletes its events, and old events are cleared out
   automatically.
8. **Robots check the whole website.** Browser tests click through real journeys, and an
   accessibility robot (axe) checks every page in both themes for problems people with
   disabilities would hit.
9. **The browser gets an allow-list.** The Content Security Policy tells it which
   websites EverGuide may load scripts from or talk to. Injected code can't load
   anything else.

## 60-second pitch (say this in an interview)

> "Phase 6 added demo payments, automation and a hardening pass. Payments use Razorpay
> Test Mode: the server refuses live keys, sets the price itself, and switches a plan on
> only after verifying Razorpay's HMAC signature in constant time. A row lock in Postgres
> makes the checkout callback and the webhook grant exactly one month even when both
> arrive at once. For automation I used the transactional outbox pattern. Triggers write
> events in the same transaction as the change, and a dispatcher delivers them to n8n
> signed, at least once, with exponential backoff and `SKIP LOCKED` so several servers
> can share the work. n8n verifies the signature, rejects replays older than five
> minutes, and drops duplicates by event id. Then I hardened it all. I added Playwright
> tests for the main journeys and an accessibility sweep with axe on 32 pages in both
> themes, which found a real ARIA bug. I added a Content Security Policy that allows the
> inline theme script by its hash, data-retention rules for event data, and a written
> security review. I also checked every security rule against the real Supabase project:
> 97 checks."

## What we built

| Area          | What                                                                                                            | Where                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Database      | Orders, plan periods, webhook events (migration 6); outbox and reminders (migration 7); retention (migration 8) | `database/migrations/2026102[79]0000[6-8]_*.sql`                                                                |
| Payments      | Test Mode checkout, signature checks, webhook, AI allowance by plan                                             | `server/src/services/billing-service.ts`, `server/src/lib/razorpay.ts`, `client/src/pages/app/billing-page.tsx` |
| Automation    | Signed dispatcher, admin Automation tab, n8n workflow, test inbox                                               | `server/src/services/outbox-dispatcher.ts`, `automation/n8n/`                                                   |
| Browser tests | Journeys, accessibility and contrast, phone layout                                                              | `e2e/`                                                                                                          |
| Security      | CSP, security review, real-project checks                                                                       | `client/csp.ts`, `docs/security-review.md`, `database/tests/verify-rls.mjs`                                     |

## Key concepts, explained

**HMAC signature.** A fingerprint of a message made with a secret key
(`HMAC-SHA256(secret, message)`). Anyone can see the message, but only someone with the
secret can produce the matching fingerprint. Razorpay signs `order_id|payment_id`; we
sign our own events as `timestamp.body`.

**Constant-time comparison.** Comparing two strings character by character stops at the
first difference, so the time taken leaks how much was right. `crypto.timingSafeEqual`
always takes the same time.

**Raw body for webhooks.** The signature covers the exact bytes sent. If the server
parses the JSON and re-serialises it, a single space difference breaks the check. So the
webhook route reads the raw body before the JSON parser.

**Idempotency.** Doing something twice has the same effect as doing it once. Three tools
give us that:

- a row lock on the order (`select … for update`)
- unique keys: one plan period per order, one row per webhook event id
- a dedupe key on every outbox event

**Transactional outbox.** Writing to the database and then calling n8n can fail halfway
and lose an email. Instead, the event is written in the same transaction as the change,
and delivered afterwards by a separate loop.

**At-least-once delivery.** The loop retries until n8n says "OK". Exactly-once is
impossible over a network: the reply can get lost after n8n acted. So receivers must
ignore repeats.

**Exponential backoff.** After each failure, the next try waits twice as long (30 s,
1 min, 2 min … up to 1 h). After 8 tries the event is parked as _failed_ for a human to
retry.

**`FOR UPDATE SKIP LOCKED` and leases.** Each server takes a batch of rows that no other
server has locked, and "leases" them for 60 seconds. If it crashes mid-send, the lease
runs out and another server takes over.

**Replay protection.** A valid signed request captured by an attacker could be re-sent
later. Signing the timestamp too, and refusing anything older than 5 minutes, closes
that.

**Data retention.** Data should be kept only as long as it's needed. Deleting an account
deletes the events that mention it. Delivered events go after 30 days and failed ones
after 90.

**Content Security Policy (CSP).** A list the browser enforces, for example "scripts
only from this site and Razorpay". Our one inline script is allowed by its SHA-256 hash,
so any injected inline script is blocked.

**The testing pyramid.** Many fast unit tests, fewer integration tests against the real
database, and a few slow browser tests for whole journeys. Each layer catches different
bugs:

| Layer       | Count     | What it is                                        |
| ----------- | --------- | ------------------------------------------------- |
| Unit        | 586       | shared 46, server 236, database 86, client 172    |
| Integration | —         | against real Supabase                             |
| `db:verify` | 97 checks | access rules checked directly on the real project |
| Browser     | 87        | whole journeys in Chrome                          |

## Bugs found, and how (great interview stories)

| Bug                                                                       | How it was found                        | Fix                                                                                  |
| ------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| Home page JavaScript jumped from 177 to 206 kB                            | Bundle budget check in the build        | The shared plan table pulled in the validation library; it moved to a separate entry |
| Pricing promised two Premium features that don't exist                    | Reading the copy                        | Plans now list only what they really change (the AI allowance)                       |
| An integration test would have marked _real_ events as sent to a fake n8n | Reviewing my own test before running it | The test touches only its own events                                                 |
| n8n reminders would fire for sessions cancelled meanwhile                 | Thinking through the design             | The database queues reminders only for sessions still confirmed                      |
| The newest n8n needs Node 24 (we have 22)                                 | Checking package requirements           | Pinned n8n 2.35.7                                                                    |
| Automation events kept first names after an account was deleted           | Security review                         | Migration 8: delete with the account; purge old events                               |
| Admin chart bars had labels screen readers may ignore                     | axe accessibility sweep                 | `role="img"` on each bar                                                             |
| Chrome crashed during the long accessibility run                          | Browser trace                           | Leaked browser windows; one test per page, and windows close after each test         |
| A booking test failed late at night                                       | Trace showed the stuck step             | Today had too few slots left; the test picks tomorrow                                |
| The API's rate limiter blocked the test run                               | Screenshot: "Too many requests"         | Looser general limit in development only                                             |
| The CSP blocked Razorpay's fraud-check script                             | Console error in a CSP test run         | Allowed `cdn.razorpay.com`                                                           |
| Two security checks passed for the wrong reason (404 "no such function")  | Reading the output, not just "PASS"     | Called the functions with real arguments; now a real 403                             |
| Test accounts left behind by crashed or network-dropped runs              | Counting accounts before a cleanup      | Test setup retries network errors; verified leftovers deleted                        |

## How companies do this

- **Payment providers' sandbox modes** (Razorpay Test Mode, Stripe test keys) are used in
  development and staging. Live keys exist only in production, behind access controls.
- **Webhooks are verified, idempotent and replay-safe**: signature checks, event-id
  dedupe tables, and quick 200 responses with the heavy work done afterwards.
- **The outbox pattern** (often with Debezium or a queue like Kafka or SQS) is the
  standard way to send events reliably from a database-backed service.
- **End-to-end tests run in CI** on every pull request, against a staging environment,
  with traces and screenshots kept for failures.
- **Accessibility** is checked with axe in CI plus manual screen-reader testing. Many
  companies must meet WCAG 2.1 AA by law.
- **Security reviews** happen before launch and after big changes: threat model,
  controls, tests, and a list of accepted risks with owners. Retention rules usually
  come from privacy laws (GDPR, India's DPDP Act).

## Likely interview questions

**Q: How do you stop someone from faking a successful payment?**
A: The plan is granted only after the server verifies Razorpay's HMAC signature over
`order_id|payment_id` with our secret, compared in constant time, for an order that
belongs to that user. The price comes from the server, never the browser.

**Q: The webhook and the browser both report the same payment. What happens?**
A: Both go through one database function that locks the order row. The first one grants
the month and marks the order paid; the second sees it's paid and returns the same
period.

**Q: Why not just call n8n right after saving a booking?**
A: If the call fails, or the server crashes between the save and the call, the email is
lost. And if the save rolls back after the call, an email goes out for something that
never happened. The outbox writes the event in the same transaction and delivers it
afterwards, with retries.

**Q: Can you guarantee an event is delivered exactly once?**
A: Not over a network. We deliver at least once and make repeats harmless with a dedupe
key that n8n checks.

**Q: How do two servers process the same queue without double-sending?**
A: `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` with a lease: each server
takes rows no one else holds, and an expired lease lets another server take over after a
crash.

**Q: What does your Content Security Policy protect against, and what can't it do?**
A: It stops injected scripts from loading code or sending data to other sites. As a
`<meta>` tag it can't set `frame-ancestors`, so it can't stop other sites from framing
EverGuide. That needs an HTTP header when deploying.

**Q: How do you test accessibility?**
A: axe runs WCAG 2.1 A/AA rules on 32 pages in both themes in the browser tests. A
custom check measures real text contrast against blended backgrounds. Manual keyboard
and screen-reader testing still matters; tools find only part of the problems.

## What I'd improve next

- Verify Razorpay Checkout under the CSP again. Razorpay's API timed out from this
  network during the final run, so that one browser test couldn't complete.
- Run the browser tests in CI against a staging Supabase project, not the development
  one.
- Send the CSP as an HTTP header with `frame-ancestors 'none'`, and shorten the login
  token lifetime, when deploying.
- Real email delivery (a provider like Resend) with per-user addresses, unsubscribe
  links and bounce handling, instead of the test inbox.
- The remaining open items in `docs/security-review.md`.
