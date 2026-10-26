# Phase 4: Career Studio and Mentor Marketplace

## 60-second pitch (say this in an interview)

> "Phase 4 added the product modules around the AI Guide: a career roadmap, a resume analyser, interview practice, and a mentor marketplace. The hardest part was booking. Two people can click the same time slot at the same moment, so a check-then-insert in application code isn't safe. I enforced it in Postgres with exclusion constraints on time ranges, so the database itself refuses an overlapping booking for the same mentor or the same mentee, however many servers are running. Booking rules such as the 12-hour cancellation window and who may confirm live in SECURITY DEFINER functions, so they can't be bypassed through the Supabase API. Availability is stored in the mentor's local time and turned into real instants by Postgres, which keeps it correct across daylight-saving changes; I wrote a test for the US clock change on 1 November. Docker wasn't available, so I built a test harness that runs every migration in PGlite, which is Postgres compiled to WebAssembly, and I mutation-tested it: deleting the overlap constraint makes tests fail. Resumes go to a private storage bucket, the server checks the PDF's signature before parsing it, and the AI's report is structured JSON validated with zod. Testing in a real browser with three separate accounts caught bugs the unit tests missed, such as the booking panel widening the whole page on phones."

## What we built

| Area | What | Where |
|---|---|---|
| Database | Goals, milestones, resumes (private bucket), interview practice, mentor profiles, verifications, availability, bookings, reviews; booking functions | `database/migrations/20261025000003_career_and_mentors.sql` |
| DB test harness | PGlite + Supabase stubs; runs all migrations offline in seconds | `database/test/harness.ts`, `database/test/phase4.test.ts` |
| Roadmap | Goals with milestones, progress, recommended reading via the AI Guide's search | `server/src/services/career-service.ts`, `client/src/pages/career/` |
| Resume analyser | Raw PDF upload, signature + parse checks, text extraction, structured AI report, full deletion | `server/src/lib/pdf.ts`, `server/src/services/resume-service.ts` |
| Interview practice | 32-question bank, saved questions, attempts, optional AI feedback | `server/src/services/interview-service.ts` |
| Shared AI allowance | One monthly meter for every AI feature | `server/src/services/usage-meter.ts` |
| Mentor API | Directory, slots, booking lifecycle, applications, admin review, notifications | `server/src/routes/mentors.ts`, `server/src/services/mentor-service.ts` |
| Mentor UI | Public directory/profile, Find / My sessions / Mentor profile tabs, admin queue, notification bell | `client/src/pages/mentors/`, `client/src/components/mentors/` |

## How a booking works (draw this on a whiteboard)

```
Mentor sets weekly windows (local time, e.g. Mon 18:00–21:00, Asia/Kolkata)
        │
        ▼
mentor_open_slots()  ── local date + local time  ──▶  "at time zone" ──▶ real UTC instants
        │                 minus slots < 2 h away, minus slots overlapping active bookings
        ▼
Mentee picks a slot (shown in the mentee's own time zone)
        │ POST /bookings
        ▼
request_booking()  ── inserts status 'requested' ──▶ exclusion constraints check overlap
        │                                            (23P01 if two requests race)
        ▼
respond_to_booking()  ── mentor accepts with a meeting link ──▶ 'confirmed' + notification
        │
        ▼
After ends_at: shown as "completed"; submit_mentor_review() allows one review per session
```

## Key concepts, explained

**Exclusion constraints.** A unique constraint says "no two rows have the same value". An exclusion constraint generalises it: "no two rows where *these operators* are all true". Ours is:

```sql
exclude using gist (mentor_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status in ('requested', 'confirmed'))
```

That means: no two active bookings for the same mentor whose time ranges overlap (`&&`). The `'[)'` bound makes 10:00–10:30 and 10:30–11:00 not overlap. The `where` clause means cancelled bookings free the slot. Mixing `=` on a uuid with `&&` on a range in one GiST index needs the `btree_gist` extension.

**Why not check in code?** "Select overlapping bookings; if none, insert" has a gap between the select and the insert. Two requests can both pass the check, then both insert. This is a *race condition*. The constraint is checked inside the database at commit, so the second insert fails with error `23P01` no matter how many servers you run.

**SECURITY DEFINER functions with `search_path = ''`.** The function runs with its owner's rights, so it can update a booking even though the user's RLS policies don't allow direct updates. That makes the function the *only* door: the rules inside it (only the mentor can confirm; no cancelling a confirmed session within 12 hours) can't be skipped. `search_path = ''` forces every name to be schema-qualified (`public.bookings`), so nobody can plant a look-alike table or function that the definer would run with raised rights.

**Not found vs forbidden.** If you ask to review someone else's booking, the function says "Booking not found" (P0002), not "forbidden". Saying "forbidden" would confirm that the ID exists, which leaks information.

**Time zones and daylight saving.** Store instants in UTC (`timestamptz`). Store *recurring* availability as local wall-clock times plus the mentor's IANA zone (`Asia/Kolkata`, `America/New_York`), because "Monday 18:00" means a different UTC time in summer and winter. Postgres converts with `at time zone`. Never store "+05:30" offsets for recurring things; offsets change, zones don't.

**`FOR UPDATE` row locks.** `respond_to_booking`, `cancel_booking` and `reschedule_booking` read the booking with `select … for update`, which locks the row until the transaction ends. Two simultaneous "accept" and "cancel" clicks run one after the other instead of both reading the old status.

**PGlite and mutation testing.** PGlite is real Postgres compiled to WebAssembly and runs inside Node, so the migration tests need no Docker and take seconds. Mutation testing asks "would my tests notice if the code were wrong?": I deliberately broke the code (removed the overlap constraint, weakened the 12-hour rule, reintroduced a banned pattern) and checked that tests failed. A test that still passes against broken code is giving false confidence.

**Server-enforced roles.** The admin queue is protected by `requireRole('admin')` on the server, which reads `user_roles` from the database. The client's `RequireRole` only hides the screen; it is a convenience, not security, because anyone can edit JavaScript in their browser.

**Optimistic UI.** When you tick a milestone, the checkbox updates instantly and the request runs in the background; on failure it rolls back. TanStack Query notifies components a tick later, so the instant state lives in local React state.

**Structured AI output.** The resume report and interview feedback are requested as JSON matching a schema, then validated with zod. If the model returns the wrong shape, the user sees a retryable error and the AI message is refunded. Never trust a model's output format.

**Performance budget.** The build fails if the JavaScript a first-time visitor downloads exceeds 185 kB gzip. Adding the notification bell (which pulls in a positioning library) pushed it to 190 kB. Instead of raising the limit, I lazy-loaded the signed-in app shell, so public visitors don't download it at all.

## Bugs found, and how (great interview stories)

| Bug | How it was found | Fix |
|---|---|---|
| Milestone checkbox flickered back after clicking | Real browser | Local optimistic state; the query cache updates a tick later |
| Resume upload worked in tests, failed in browsers | Real browser (CORS preflight) | Allow the `X-File-Name` header; added a security test |
| AI reports guessed the user's gender from their name | Reading real output | Prompts say "you"; integration test rejects gendered pronouns |
| Account deletion left resume files in storage | Privacy review | Delete `${userId}/` files before the auth user |
| `mutationFn: api.x` passed TanStack's context as a second argument | Code review | Wrapped calls; convention test, checked by reintroducing the bug |
| Booking panel widened the page to 1458 px on phones | 3-person browser E2E at 390 px | Grid items default to `min-width: auto`; `minmax(0,1fr)` + `min-w-0` |
| "Request sent" banner came back on reload | E2E screenshot review | Browsers keep history state across reloads; show once, then clear |
| First-load JS 190 kB > 185 kB budget | Build-time budget check | Lazy-load the app shell (177.7 kB) |
| Overlap check through the Supabase API returned 400, not the expected 409 | `db:verify` on real Supabase | Assert the database error code `23P01`, which proves the constraint fired |

## Trade-offs

- **Logic in SQL** is race-proof and can't be bypassed, but it's harder to read and debug than TypeScript. Mitigated by PGlite tests and `db:verify`.
- **Polling notifications every 60 s** is simple and cheap but can be a minute late. Realtime (websockets) is a later upgrade.
- **Raw-body upload** avoids a multipart library, but the file name travels in a header, which CORS must allow.
- **Hand-written database types** work now but can drift; generating them from the schema is on the backlog.

## How companies do this

- **Correctness in the database.** Payments, bookings and inventory teams rely on constraints, transactions and idempotency keys rather than "check then write" in code. Code reviewers ask "what happens if this runs twice at the same time?"
- **Migrations are code.** Every schema change is a reviewed, versioned file, tested in CI against a throwaway database (Docker, or something like PGlite) before it reaches production.
- **Time zones** are a classic bug source. Companies store UTC, keep the user's IANA zone, and test DST transitions explicitly.
- **Trust & safety.** Marketplaces verify supply-side users (mentors, drivers, sellers) with evidence and a human review queue. Every decision is audit-logged so it can be explained later.
- **Performance budgets** run in CI; a regression blocks the merge and someone decides to optimise or explicitly raise the budget.
- **E2E tests** for critical journeys (sign-up, checkout, booking) run in CI with Playwright against a staging environment, often with several test users at once.

## Likely interview questions

**Q: How do you prevent double-booking?**
A: An exclusion constraint on `(mentor_id =, time range &&)` for active bookings, plus a second one for the mentee. It's checked atomically by Postgres, so concurrent requests can't both succeed. The API maps the database error to a 409 Conflict with a friendly message.

**Q: Why not a unique constraint on (mentor_id, starts_at)?**
A: It only blocks identical start times. A 10:00–11:00 booking and a 10:30–11:00 booking have different starts but overlap. Ranges need an overlap operator.

**Q: What is SECURITY DEFINER and what's the risk?**
A: The function runs with its owner's privileges. The risk is search-path hijacking, where a caller creates an object the function resolves by name. Setting `search_path = ''` and schema-qualifying every name prevents it. The function must also check `auth.uid()` itself, because RLS is bypassed inside it.

**Q: How do you handle time zones?**
A: Instants in UTC; recurring availability as local times with the mentor's IANA zone; the database converts per date, so DST works. The UI shows times in the viewer's zone and says which zone that is.

**Q: How do you test SQL?**
A: PGlite runs every migration in-process, with stubs for Supabase's `auth` schema, so tests can act as different users. A separate script checks the real Supabase project's RLS. I mutation-tested both.

**Q: How do you keep an AI feature from returning garbage?**
A: A response schema, validation with zod, a refund and retry when validation fails, a low temperature, and prompts that forbid guessing personal details like gender.

**Q: A role check exists in the React app. Is that enough?**
A: No. Client checks are UX only. The server checks the database role on every admin request; the database's RLS is a further layer.

**Q: What's a performance budget, and what did you do when you broke it?**
A: A build-time limit on the JavaScript every visitor downloads. When a new popover library pushed it over, I moved the signed-in shell into a lazily loaded chunk instead of raising the limit, because public visitors don't need it.

## What I'd improve next

- Realtime notifications, plus email reminders through n8n (Phase 6).
- Move the browser E2E scripts into the repo as Playwright tests that run in CI.
- Generate database types from the schema.
- Map "not found" in SQL functions to an error code PostgREST returns as 404 (today our API translates it).
- Calendar invites (.ics) and video links created automatically instead of pasted.
