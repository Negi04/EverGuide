/**
 * The n8n side of automation: the Code node that checks signatures runs here with
 * stand-ins for n8n's $input and $env, against events signed by the real server code.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { signEvent } from '../src/lib/event-signing.ts'

const N8N_DIR = new URL('../../automation/n8n/', import.meta.url)
const source = readFileSync(new URL('verify-signature.js', N8N_DIR), 'utf8')
const compose = readFileSync(new URL('compose-email.js', N8N_DIR), 'utf8')
const workflow = JSON.parse(
  readFileSync(new URL('workflows/everguide-events.json', N8N_DIR), 'utf8'),
) as { nodes: { name: string; type: string; parameters: Record<string, unknown> }[] }

const secret = 'a-test-secret-that-is-at-least-32-chars'

type Output = { json: { valid: boolean; event: unknown } }[]

/** Run the Code node's script the way n8n does, with one incoming webhook item. */
function runCodeNode(
  item: { headers: Record<string, string>; body: unknown },
  env = { EVERGUIDE_WEBHOOK_SECRET: secret },
) {
  const run = new Function('$input', '$env', 'require', source) as (...args: unknown[]) => Output
  return run({ all: () => [{ json: item }] }, env, createRequire(import.meta.url))[0]!.json
}

/** What n8n's Webhook node hands on: lower-case headers and the parsed JSON body. */
function delivery(body: object, { timestamp = Math.floor(Date.now() / 1000), key = secret } = {}) {
  const text = JSON.stringify(body)
  return {
    headers: {
      'x-everguide-timestamp': String(timestamp),
      'x-everguide-signature': signEvent(key, timestamp, text),
    },
    body: JSON.parse(text) as unknown,
  }
}

const event = {
  id: 'booking.confirmed:b1:1800000000',
  type: 'booking.confirmed',
  occurredAt: '2026-10-27T10:00:00Z',
  data: { bookingId: 'b1', menteeFirstName: 'Aditi', mentorFirstName: 'Ravi', note: 'नमस्ते' },
}

describe('n8n signature check', () => {
  it('accepts an event signed by the server', () => {
    expect(runCodeNode(delivery(event))).toEqual({ valid: true, event })
  })

  it('refuses a wrong secret, an edited body, an old event, or a missing secret', () => {
    expect(runCodeNode(delivery(event, { key: 'some-other-secret-some-other-secret' })).valid).toBe(
      false,
    )
    const tampered = delivery(event)
    ;(tampered.body as typeof event).data.bookingId = 'b2'
    expect(runCodeNode(tampered).valid).toBe(false)
    const old = delivery(event, { timestamp: Math.floor(Date.now() / 1000) - 600 })
    expect(runCodeNode(old).valid).toBe(false)
    expect(runCodeNode(delivery(event), { EVERGUIDE_WEBHOOK_SECRET: '' }).valid).toBe(false)
  })

  it('hands on nothing from a refused event', () => {
    expect(runCodeNode({ headers: {}, body: event }).event).toBeNull()
  })
})

describe('workflow file', () => {
  it('runs exactly this script in its Code node', () => {
    const node = workflow.nodes.find((n) => n.name === 'Verify signature')
    expect(node?.type).toBe('n8n-nodes-base.code')
    expect(node?.parameters.jsCode).toBe(source)
  })

  it('runs exactly this script in its Compose email node', () => {
    expect(workflow.nodes.find((n) => n.name === 'Compose email')?.parameters.jsCode).toBe(compose)
  })

  it('stores no secret: it is read from the n8n environment', () => {
    expect(JSON.stringify(workflow)).not.toMatch(/[0-9a-f]{32,}/)
    expect(source).toContain('$env.EVERGUIDE_WEBHOOK_SECRET')
  })
})

describe('emails', () => {
  const migration = readFileSync(
    new URL('../../database/migrations/20261027000007_automation_outbox.sql', import.meta.url),
    'utf8',
  )
  const produced = new Set(
    [...migration.matchAll(/'((?:user|booking|payment|admin)\.[a-z_]+)'/g)].map((m) => m[1]!),
  )
  // Booking status events are built as 'booking.' || status.
  for (const status of ['confirmed', 'declined', 'cancelled']) produced.add(`booking.${status}`)

  const data = {
    userId: 'u1',
    firstName: 'Aditi',
    bookingId: 'b1',
    startsAt: '2026-10-28T12:30:00Z',
    endsAt: '2026-10-28T13:00:00Z',
    mentorFirstName: 'Ravi',
    menteeFirstName: 'Aditi',
    menteeTimezone: 'Asia/Kolkata',
    plan: 'pro',
    amountPaise: 19_900,
    periodEnd: '2026-11-27T10:00:00Z',
    mentorUserId: 'm1',
  }
  const composeFor = (type: string) => {
    const run = new Function('$input', compose) as (input: unknown) => {
      json: { to: string; subject: string; text: string; eventId: string }
    }[]
    return run({ all: () => [{ json: { event: { id: `${type}:1`, type, data } } }] })
  }

  it.each([...produced])('writes an email for %s, to a test inbox only', (type) => {
    const [email] = composeFor(type)
    expect(email?.json.subject).toBeTruthy()
    expect(email?.json.to).toMatch(/@everguide\.test$/)
    expect(email?.json.text).not.toContain('undefined')
  })

  it('shows times in the mentee’s own time zone and labels receipts as demo', () => {
    expect(composeFor('booking.confirmed')[0]!.json.text).toContain('6:00 pm')
    const receipt = composeFor('payment.succeeded')[0]!.json.text
    expect(receipt).toContain('₹199.00')
    expect(receipt).toMatch(/DEMO receipt/)
  })

  it('skips event types it does not know', () => {
    expect(composeFor('something.else')).toEqual([])
  })
})
