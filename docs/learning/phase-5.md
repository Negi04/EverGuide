# Phase 5: Wellness, Finance, Resources, Images and the Admin portal

## Start here: Phase 5 in plain words

If everything feels like a lot, read only this section first. Each point is one idea.

1. **Every person only sees their own data.** The database itself checks "is this row yours?" on every read and write (that's RLS, row level security). Even if our server code had a bug, someone else's journal or budget stays hidden.
2. **Money is stored as whole paise, never decimals.** Computers can't store 0.1 exactly, so ₹15.50 is saved as 1550. We convert only when showing it.
3. **"Today" depends on where you are.** At 2am in India it's still yesterday in New York. Habit streaks use the person's own time zone.
4. **The database refuses bad data by itself.** For example, you can't withdraw more than you saved, even if two withdrawals happen at the same moment.
5. **Public pages use a "visitor" key, not the master key.** So the database's rules still protect drafts even if our code forgets a filter.
6. **Images go straight from the browser to Cloudinary.** Our server only signs a one-time permission slip and then double-checks what was uploaded.
7. **Admins can do a lot, so everything they do is written down** in the audit log, and admin tools show counts, not private content.
8. **Tests prove it works, and "mutation testing" proves the tests work:** we break the code on purpose and check a test fails.

## 60-second pitch (say this in an interview)

> "Phase 5 completed EverGuide's guidance tools and gave admins control. I built a private journal, habit tracking with time-zone-correct streaks, budgets and savings goals, educational calculators, a resource library, Cloudinary image uploads and an admin portal. Privacy is enforced in the database with row level security, and public pages read through an anonymous client so the database still hides drafts if code forgets a filter. I demonstrated that by removing the filter and watching drafts stay hidden. Money is integer paise parsed from text, so there are no floating-point errors. Savings use a ledger, and a SQL function locks the goal row so concurrent withdrawals can't overdraw it. Images use signed direct uploads: the server picks the file name and checks every upload with Cloudinary before saving it. Admin actions are all audited, and uploaded knowledge documents are always drafts until approved; a test showed a draft is invisible to the AI's search until approval. Real-browser testing caught problems unit tests couldn't, like an invisible 1-pixel element that made phone pages scroll sideways, and a Supabase API limit that silently returns only 1,000 rows."

## What we built

| Area | What | Where |
|---|---|---|
| Database | Journal, habits, check-ins, budgets, savings ledger, resources, bookmarks, admin functions (migration 4); cover images (migration 5) | `database/migrations/2026102600000[4-5]_*.sql` |
| Wellness | Breathing (reduced-motion aware), private journal, habits with streaks, support | `client/src/pages/wellness/`, `server/src/services/wellness-service.ts` |
| Finance | Budget planner, savings goals, SIP/EMI/compound interest, glossary | `client/src/pages/finance/`, `shared/src/finance.ts` |
| Resources | Public + in-app library, search, saving, click-to-load video | `client/src/components/resources/`, `server/src/services/resources-service.ts` |
| Images | Signed Cloudinary uploads, server-side checks, responsive delivery | `server/src/lib/cloudinary.ts` |
| Admin | Overview, users and roles, mentors, resources, knowledge base, feedback, audit log | `client/src/pages/admin/`, `server/src/services/admin-service.ts` |

## Key concepts, explained

**Row level security (RLS).** A rule attached to a table, like "a row is visible only if `user_id` equals the signed-in user". The database applies it to every query, so it protects data even from bugs in our code.

**Three kinds of database client.** *User client* (acts as the person, RLS applies), *anonymous client* (acts as a visitor, RLS applies), *service client* (bypasses RLS, only after the server has checked permissions itself). Using the weakest client that can do the job is called *least privilege*.

**Integer money.** `0.1 + 0.2` is `0.30000000000000004` in JavaScript. Storing paise as integers and parsing typed text ("1,50,000.50") directly avoids that.

**Ledger instead of a balance column.** Savings are a list of deposits and withdrawals; the balance is their sum, like a bank statement. The history always explains the number.

**Row locks (`SELECT … FOR UPDATE`).** Two withdrawals at once would both see the old balance. Locking the goal row makes the second wait for the first.

**Pure functions for tricky logic.** Streaks, dates, calculators and budget totals take inputs and return outputs with no database or clock, so they're easy to test with fixed values.

**Silent API limits.** Supabase returns at most 1,000 rows per request with no error. Reading in pages fixed wrong streaks (a 200-day streak showed as 167).

**Optimistic updates.** The UI changes instantly (tick a habit, save a resource) and rolls back if the server says no.

**Signed direct uploads.** The browser uploads to Cloudinary using a signature only our server can make (it needs the secret). The signature fixes the file name and allowed formats, so they can't be changed. The server then asks Cloudinary what actually arrived.

**Audit log.** An append-only record of sensitive actions: who, what, when. Useful for trust, debugging and compliance.

**Never edit an applied migration.** The database won't run it again, so the repo and the real schema would disagree. A test fingerprints applied migrations to enforce this.

## Bugs found, and how (great interview stories)

| Bug | How it was found | Fix |
|---|---|---|
| Streaks wrong for many habits (1,000-row cap) | Integration test with 1,200 check-ins | Read in pages |
| Budget income couldn't be saved: upsert needs UPDATE on every column | Integration test (HTTP 403) | Insert-if-missing, then update one column; kept tight permissions |
| Phone page 481 px wide | Browser test; measured positioned elements | A screen-reader-only label escaped its scroll box; responsive rows |
| "Spent" column hidden on phones | Screenshot review | Responsive item rows |
| Calculator labels didn't focus inputs | Component test | Label pointed at a wrapper; fixed the component |
| Stray character committed into a migration | Database tests | Restored; fingerprint test; read staged diffs before committing |
| Pages claimed answers come from "reviewed" sources | Searching the copy | Guides are AI-drafted; wording corrected |
| Cloudinary key could connect but not upload | Real upload in a test | New keys start with no permissions; the check script now uploads |
| JSON limit (100 KB) smaller than allowed documents (200 KB) | Code review | Documents capped at 80,000 characters |

## How companies do this

- **Privacy reviews** before shipping features with personal data (journals, money): what's stored, who can see it, how it's deleted.
- **Least privilege** for credentials and database access; secrets only on servers; separate accounts or environments for development and production.
- **Migrations are reviewed and immutable** once applied; tools like Flyway and Rails check fingerprints.
- **Admin tools are audited**, and access to them is itself reviewed regularly.
- **Content workflows** (draft → review → publish) for anything users or an AI will rely on.
- **Third-party services** (Cloudinary, payment providers) are wrapped in a small module, tested against the real service in a staging account, and checked with a health script.

## Likely interview questions

**Q: How do you keep one user's data private from another?**
A: RLS in the database on every table, a client that acts as the signed-in user, and tests (including against the real database) that try to read other people's rows.

**Q: Why not store money as a decimal number?**
A: Binary floating point can't represent most decimal fractions exactly, so sums drift. Integer paise are exact; convert only for display.

**Q: Two withdrawals happen at once. What stops the balance going negative?**
A: A database function locks the goal row, sums the ledger, and refuses if the result would be negative. The second call waits for the first.

**Q: How do image uploads stay secure without passing through your server?**
A: The server signs each upload with a secret, fixing the file name and allowed formats. Cloudinary rejects any change. Before saving, the server asks Cloudinary for the real format, size and width.

**Q: What's defence in depth? Give an example.**
A: Several independent protections. Public resource reads filter for "published" in code *and* use an anonymous client so RLS also hides drafts. I removed the filter and drafts stayed hidden.

**Q: How do you know your tests are meaningful?**
A: Mutation testing: deliberately break the code (remove the overdraft check, the rollback, the guard) and confirm a test fails.

## What I'd improve next

- A scheduled job that deletes Cloudinary images left by cancelled forms.
- Server-side user search before the user count grows large.
- Ranking resource search by relevance.
- A "reviewed" state for AI feedback, linked to the knowledge document to fix.
- Moving the browser test scripts into the repo so they run in CI (Phase 6).
