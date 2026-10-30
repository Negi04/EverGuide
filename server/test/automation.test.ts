import { pino } from 'pino'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config/env.ts'
import { signEvent, verifyEvent } from '../src/lib/event-signing.ts'
import type { Db } from '../src/lib/supabase.ts'
import type { AutomationService } from '../src/services/automation-service.ts'
import { createOutboxDispatcher, type EventEnvelope } from '../src/services/outbox-dispatcher.ts'
import { buildTestApp, VALID_TOKEN } from './helpers.ts'

const secret = 'a-test-secret-that-is-at-least-32-chars'
const logger = pino({ level: 'silent' })
const NOW = 1_800_000_000

describe('event signatures', () => {
  const body = '{"id":"user.welcome:1","type":"user.welcome"}'

  it('verifies a fresh, untouched event', () => {
    expect(verifyEvent(secret, String(NOW), body, signEvent(secret, NOW, body), NOW + 10)).toBe(
      true,
    )
  })

  it('refuses a changed body, a wrong secret or a changed timestamp', () => {
    const signature = signEvent(secret, NOW, body)
    expect(verifyEvent(secret, String(NOW), body.replace('1', '2'), signature, NOW)).toBe(false)
    expect(
      verifyEvent('another-secret-another-secret-123', String(NOW), body, signature, NOW),
    ).toBe(false)
    expect(verifyEvent(secret, String(NOW + 1), body, signature, NOW)).toBe(false)
  })

  it('refuses a correctly signed event that is too old to be fresh (a replay)', () => {
    expect(verifyEvent(secret, String(NOW), body, signEvent(secret, NOW, body), NOW + 301)).toBe(
      false,
    )
    expect(verifyEvent(secret, undefined, body, signEvent(secret, NOW, body), NOW)).toBe(false)
  })
})

describe('automation config', () => {
  const base = {
    CORS_ORIGINS: 'http://localhost:5173',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key-anon-key-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key-service-key-service',
  }

  it('is off without settings and on with both', () => {
    expect(loadConfig(base).automation).toBeNull()
    expect(
      loadConfig({
        ...base,
        N8N_WEBHOOK_URL: 'http://localhost:5678/webhook/everguide',
        N8N_WEBHOOK_SECRET: secret,
      }).automation,
    ).toEqual({ webhookUrl: 'http://localhost:5678/webhook/everguide', secret })
  })

  it('refuses a short secret or half a configuration, without printing the secret', () => {
    expect(() =>
      loadConfig({
        ...base,
        N8N_WEBHOOK_URL: 'http://localhost:5678/x',
        N8N_WEBHOOK_SECRET: 'short',
      }),
    ).toThrow(/N8N_WEBHOOK_SECRET/)
    try {
      loadConfig({ ...base, N8N_WEBHOOK_SECRET: secret })
      expect.unreachable()
    } catch (error) {
      expect(String(error)).toMatch(/N8N_WEBHOOK_URL/)
      expect(String(error)).not.toContain(secret)
    }
  })
})

// ---------------------------------------------------------------------
// The dispatcher, with the database functions faked
// ---------------------------------------------------------------------

type Finish = { p_id: number; p_ok: boolean; p_error: string | null }

function fakeOutbox(events: object[]) {
  const finished: Finish[] = []
  let claims = 0
  const db = {
    rpc: async (name: string, args: Finish) => {
      if (name === 'enqueue_due_reminders' || name === 'purge_outbox_events') {
        return { data: 0, error: null }
      }
      if (name === 'claim_outbox_events') {
        claims++
        return { data: claims === 1 ? events : [], error: null }
      }
      finished.push(args)
      return { data: null, error: null }
    },
  }
  return { db: db as unknown as Db, finished, claims: () => claims }
}

const welcome = {
  id: 7,
  event_type: 'user.welcome',
  dedupe_key: 'user.welcome:abc',
  created_at: '2026-10-27T10:00:00Z',
  payload: { userId: 'abc', firstName: 'Asha' },
  attempts: 1,
}

describe('outbox dispatcher', () => {
  it('sends a signed envelope and records the success', async () => {
    const outbox = fakeOutbox([welcome])
    const received: { headers: Headers; body: string }[] = []
    const dispatcher = createOutboxDispatcher({
      admin: outbox.db,
      target: { webhookUrl: 'http://n8n.test/webhook/everguide', secret },
      logger,
      nowSeconds: () => NOW,
      fetch: async (_url, init) => {
        received.push({ headers: new Headers(init?.headers), body: String(init?.body) })
        return new Response('ok')
      },
    })

    expect(await dispatcher.tick()).toBe(1)
    const [{ headers, body }] = received as [{ headers: Headers; body: string }]
    const envelope = JSON.parse(body) as EventEnvelope
    expect(envelope).toEqual({
      id: 'user.welcome:abc',
      type: 'user.welcome',
      occurredAt: '2026-10-27T10:00:00Z',
      data: { userId: 'abc', firstName: 'Asha' },
    })
    expect(headers.get('X-EverGuide-Event-Id')).toBe('user.welcome:abc')
    // The receiver can check it with nothing but the shared secret.
    expect(
      verifyEvent(
        secret,
        headers.get('X-EverGuide-Timestamp')!,
        body,
        headers.get('X-EverGuide-Signature')!,
        NOW,
      ),
    ).toBe(true)
    expect(outbox.finished).toEqual([{ p_id: 7, p_ok: true, p_error: null, p_max_attempts: 8 }])
  })

  it('records a failed delivery so the database can schedule a retry', async () => {
    for (const fetchImpl of [
      async () => new Response('nope', { status: 500 }),
      async () => {
        throw new TypeError('fetch failed')
      },
    ]) {
      const outbox = fakeOutbox([welcome])
      const dispatcher = createOutboxDispatcher({
        admin: outbox.db,
        target: { webhookUrl: 'http://n8n.test/x', secret },
        logger,
        fetch: fetchImpl as typeof fetch,
      })
      expect(await dispatcher.tick()).toBe(0)
      expect(outbox.finished[0]).toMatchObject({ p_id: 7, p_ok: false })
      expect(outbox.finished[0]!.p_error).toMatch(/500|fetch failed/)
    }
  })

  it('never runs two batches at once', async () => {
    const outbox = fakeOutbox([welcome])
    let release = () => {}
    const dispatcher = createOutboxDispatcher({
      admin: outbox.db,
      target: { webhookUrl: 'http://n8n.test/x', secret },
      logger,
      fetch: () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(new Response('ok'))
        }),
    })
    const first = dispatcher.tick()
    await new Promise((r) => setTimeout(r, 0))
    expect(await dispatcher.tick()).toBe(0)
    release()
    expect(await first).toBe(1)
    expect(outbox.claims()).toBe(1)
  })
})

// ---------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------

describe('automation admin routes', () => {
  const auth = { Authorization: `Bearer ${VALID_TOKEN}` }
  const retried: number[] = []
  const automation: AutomationService = {
    overview: async () => ({
      configured: true,
      counts: { pending: 1, sending: 0, sent: 3, failed: 1 },
      recent: [],
    }),
    retry: async (id) => {
      retried.push(id)
    },
  }

  it('are for admins only', async () => {
    const { app } = buildTestApp({ automation })
    expect((await request(app).get('/api/v1/admin/automation').set(auth)).status).toBe(403)
  })

  it('show counts and retry a failed event', async () => {
    const { app } = buildTestApp({
      automation,
      auth: {
        verifyAccessToken: async () => ({ id: 'admin-1', email: 'a@example.com' }),
        getRoles: async () => ['user', 'admin'],
      },
    })
    const overview = await request(app).get('/api/v1/admin/automation').set(auth)
    expect(overview.body.counts.failed).toBe(1)
    expect((await request(app).post('/api/v1/admin/automation/12/retry').set(auth)).status).toBe(
      204,
    )
    expect((await request(app).post('/api/v1/admin/automation/abc/retry').set(auth)).status).toBe(
      404,
    )
    expect(retried).toEqual([12])
  })
})
