# EverGuide automation (n8n, demo)

EverGuide sends signed events to [n8n](https://n8n.io), which turns them into emails.
For the demo every email goes to a **local test inbox** (MailDev), never to a real person.

```
change saved in Postgres ──trigger──▶ outbox_events ──dispatcher (every 5 s)──▶ n8n webhook
   (booking, payment, sign-up)        (same transaction)   signed, retried with backoff
                                                                   │
                         test inbox ◀── Send email ◀── Compose ◀── Skip repeats ◀── Verify signature
```

## Events

| Event                                                                        | When                                       | Email         |
| ---------------------------------------------------------------------------- | ------------------------------------------ | ------------- |
| `user.welcome`                                                               | an account is created                      | welcome       |
| `booking.requested` / `confirmed` / `declined` / `cancelled` / `rescheduled` | a session changes                          | to the mentee |
| `booking.reminder`                                                           | a confirmed session starts within the hour | reminder      |
| `payment.succeeded`                                                          | a demo plan purchase is verified           | demo receipt  |
| `admin.mentor_application`                                                   | someone applies to mentor                  | admin alert   |

Events carry ids, first names, times and plan names only: no email addresses, booking
topics, journal text or payment details.

## Run it (three terminals)

1. In `.env`, add (generate the secret with `openssl rand -hex 32`):

   ```
   N8N_WEBHOOK_URL=http://localhost:5678/webhook/everguide
   N8N_WEBHOOK_SECRET=<64 hex characters>
   ```

2. Test inbox: `automation/n8n/n8n.sh inbox` and open <http://localhost:1080>.
3. Once: `automation/n8n/n8n.sh setup` (imports the SMTP credential and the workflow).
   The first run downloads n8n, which takes a few minutes.
4. `automation/n8n/n8n.sh start`, then open <http://localhost:5678> and create the owner account.
5. Restart the EverGuide API (`npm run dev:api`). Sign up, book a session or make a demo
   payment, and watch Admin → Automation and the test inbox.

n8n 2.35.7 is pinned because it is the newest release that runs on Node 22.

## How it stays safe and correct

- **Transactional outbox.** Triggers write the event in the same transaction as the change,
  so an event exists exactly when the change was saved.
- **At-least-once delivery.** If n8n is down, the dispatcher retries after 30 s, 1 min,
  2 min … (at most an hour), and after 8 attempts parks the event as failed. An admin can
  retry it from Admin → Automation.
- **Duplicates are harmless.** Each event has a stable id (its dedupe key). n8n's
  "Skip repeats" node drops ids it has already processed.
- **Signed.** `X-EverGuide-Signature: v1=HMAC-SHA256(secret, "<timestamp>.<body>")`.
  n8n rejects bad signatures and anything older than 5 minutes (replays) with 401.

## Editing the workflow

The two Code-node scripts are plain files, tested in `server/test/n8n-workflow.test.ts`:

- `verify-signature.js`: the signature check
- `compose-email.js`: one email template per event type

After editing either, rebuild the importable file and re-import it:

```
node automation/n8n/build-workflow.mjs
automation/n8n/n8n.sh setup
```
