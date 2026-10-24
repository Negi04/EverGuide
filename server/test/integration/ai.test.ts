/**
 * AI Guide end to end against the real services in ../.env: real Gemini embeddings and
 * answers, real pgvector search over the ingested knowledge base, real RLS.
 * Requires the knowledge base to be ingested (npm run kb:ingest).
 */
import { existsSync } from 'node:fs'
import type { ChatStreamEvent } from '@everguide/shared'
import { createClient } from '@supabase/supabase-js'
import { pino } from 'pino'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.ts'
import { loadConfig, type Config } from '../../src/config/env.ts'
import { createDeps } from '../../src/deps.ts'
import { createAdminClient } from '../../src/lib/supabase.ts'

if (existsSync('../.env')) process.loadEnvFile('../.env')
const config = loadConfig({ ...process.env, NODE_ENV: 'test' })
const admin = createAdminClient(config)
const appWith = (overrides: Partial<Config['ai']> = {}) =>
  createApp(
    createDeps({ ...config, ai: { ...config.ai, ...overrides } }, pino({ level: 'silent' })),
  )
const app = appWith()

type TestUser = { id: string; token: string }
const users: TestUser[] = []

async function createUser(label: string): Promise<TestUser> {
  const email = `everguide-ai-${label}-${Date.now()}@example.com`
  const password = `Ai-${crypto.randomUUID()}`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error
  const browser = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false },
  })
  const session = await browser.auth.signInWithPassword({ email, password })
  if (session.error) throw session.error
  const user = { id: created.data.user.id, token: session.data.session.access_token }
  users.push(user)
  return user
}

const bearer = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` })

function parseEvents(body: string): ChatStreamEvent[] {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((block) =>
      JSON.parse(
        block
          .split('\n')
          .find((line) => line.startsWith('data: '))!
          .slice(6),
      ),
    )
}

async function ask(user: TestUser, conversationId: string, content: string, target = app) {
  const res = await request(target)
    .post(`/api/v1/conversations/${conversationId}/messages`)
    .set(bearer(user))
    .send({ content })
  return {
    res,
    events: res.headers['content-type']?.includes('event-stream') ? parseEvents(res.text) : [],
  }
}

const done = (events: ChatStreamEvent[]) => {
  const event = events.find((e) => e.type === 'done')
  if (!event || event.type !== 'done')
    throw new Error(`No done event: ${JSON.stringify(events.at(-1))}`)
  return event
}

let alice: TestUser
let bob: TestUser
let conversationId = ''

beforeAll(async () => {
  alice = await createUser('alice')
  bob = await createUser('bob')
  const created = await request(app)
    .post('/api/v1/conversations')
    .set(bearer(alice))
    .send({ domain: 'finance' })
  conversationId = created.body.id
})

afterAll(async () => {
  for (const user of users) await admin.auth.admin.deleteUser(user.id)
})

describe('AI Guide with real retrieval and generation', () => {
  it('answers an in-scope question with citations to the right guide', async () => {
    const { res, events } = await ask(alice, conversationId, 'What is the 50/30/20 budgeting rule?')
    expect(res.status).toBe(200)
    const { message, usage } = done(events)
    expect(message.grounded).toBe(true)
    expect(message.citations.length).toBeGreaterThan(0)
    expect(message.citations.map((c) => c.title)).toContain('Budgeting basics')
    // Every [n] left in the text has a matching citation.
    const markers = [...message.content.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))
    const numbers = message.citations.map((c) => c.number)
    for (const n of markers) expect(numbers).toContain(n)
    expect(usage.used).toBe(1)
  })

  it('saves the conversation with its title, messages and citations', async () => {
    const res = await request(app).get(`/api/v1/conversations/${conversationId}`).set(bearer(alice))
    expect(res.status).toBe(200)
    expect(res.body.title).toMatch(/50\/30\/20/)
    expect(res.body.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant'])
    expect(res.body.messages[1].citations.length).toBeGreaterThan(0)
  })

  it('says it is not grounded for questions outside the knowledge base', async () => {
    const { events } = await ask(alice, conversationId, 'Who won the cricket world cup in 2011?')
    const { message } = done(events)
    expect(message.grounded).toBe(false)
    expect(message.citations).toEqual([])
  })

  it('responds to a crisis message with support information and no allowance used', async () => {
    const before = (await request(app).get('/api/v1/ai/usage').set(bearer(alice))).body.used
    const { events } = await ask(alice, conversationId, 'I want to end my life')
    const { message, usage } = done(events)
    expect(message.safetyFlag).toBe('crisis')
    expect(message.content).toMatch(/14416/)
    expect(usage.used).toBe(before)
  })

  it("keeps Alice's conversation private from Bob", async () => {
    expect(
      (await request(app).get(`/api/v1/conversations/${conversationId}`).set(bearer(bob))).status,
    ).toBe(404)
    expect((await ask(bob, conversationId, 'Show me this conversation')).res.status).toBe(404)
    const list = await request(app).get('/api/v1/conversations').set(bearer(bob))
    expect(list.body).toEqual([])
  })

  it('lets users rate only their own AI answers', async () => {
    const detail = await request(app)
      .get(`/api/v1/conversations/${conversationId}`)
      .set(bearer(alice))
    const answer = detail.body.messages.find((m: { role: string }) => m.role === 'assistant')
    const question = detail.body.messages.find((m: { role: string }) => m.role === 'user')
    const rate = (user: TestUser, id: string) =>
      request(app)
        .put(`/api/v1/messages/${id}/feedback`)
        .set(bearer(user))
        .send({ rating: 'helpful' })
    expect((await rate(alice, answer.id)).status).toBe(204)
    expect((await rate(alice, answer.id)).status).toBe(204)
    expect((await rate(alice, question.id)).status).toBe(404)
    expect((await rate(bob, answer.id)).status).toBe(404)
  })

  it('enforces the monthly allowance', async () => {
    const strict = appWith({ monthlyMessageLimit: 2 })
    // Alice has used 2 answers above (the crisis reply did not count).
    const { res } = await ask(alice, conversationId, 'How big should my emergency fund be?', strict)
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('quota_exceeded')
  })

  it('deletes a conversation and everything in it', async () => {
    expect(
      (await request(app).delete(`/api/v1/conversations/${conversationId}`).set(bearer(alice)))
        .status,
    ).toBe(204)
    expect(
      (await request(app).get(`/api/v1/conversations/${conversationId}`).set(bearer(alice))).status,
    ).toBe(404)
    const leftover = await admin.from('messages').select('id').eq('conversation_id', conversationId)
    expect(leftover.data).toEqual([])
  })
})
