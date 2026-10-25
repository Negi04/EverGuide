/** Interview practice against the real database and real Gemini feedback. */
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { pino } from 'pino'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.ts'
import { loadConfig } from '../../src/config/env.ts'
import { createDeps } from '../../src/deps.ts'
import { createAdminClient } from '../../src/lib/supabase.ts'

if (existsSync('../.env')) process.loadEnvFile('../.env')
const config = loadConfig({ ...process.env, NODE_ENV: 'test' })
const admin = createAdminClient(config)
const app = createApp(createDeps(config, pino({ level: 'silent' })))
const userIds: string[] = []

async function signIn(label: string) {
  const email = `everguide-interview-${label}-${Date.now()}@example.com`
  const password = `Interview-${crypto.randomUUID()}`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error
  userIds.push(created.data.user.id)
  const browser = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false },
  })
  const session = await browser.auth.signInWithPassword({ email, password })
  if (session.error) throw session.error
  return { Authorization: `Bearer ${session.data.session.access_token}` }
}

let alice: Record<string, string>
let bob: Record<string, string>
let questionId = ''
const answer =
  'In my last support job two team leads asked me for urgent reports on the same day. I asked each of them about the deadline and impact, agreed an order with both, delivered the first report by noon and the second by evening, and suggested a shared request board so it would not happen again.'

beforeAll(async () => {
  alice = await signIn('alice')
  bob = await signIn('bob')
})

afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id)
})

describe('interview practice', () => {
  it('lists the approved question bank and filters by role', async () => {
    const all = await request(app).get('/api/v1/interview/questions').set(alice)
    expect(all.body.progress).toEqual({ practised: 0, total: 32 })
    const analyst = await request(app)
      .get('/api/v1/interview/questions?role=data_analyst')
      .set(alice)
    expect(analyst.body.questions).toHaveLength(5)
    questionId = all.body.questions.find(
      (q: { slug: string }) => q.slug === 'prioritising-competing-tasks',
    ).id
  })

  it('saves questions per user', async () => {
    expect(
      (
        await request(app)
          .put(`/api/v1/interview/questions/${questionId}/saved`)
          .set(alice)
          .send({ saved: true })
      ).status,
    ).toBe(204)
    const saved = await request(app).get('/api/v1/interview/questions?saved=true').set(alice)
    expect(saved.body.questions.map((q: { id: string }) => q.id)).toEqual([questionId])
    const bobSaved = await request(app).get('/api/v1/interview/questions?saved=true').set(bob)
    expect(bobSaved.body.questions).toEqual([])
  })

  it('records a practice answer without feedback and counts progress', async () => {
    const res = await request(app)
      .post(`/api/v1/interview/questions/${questionId}/attempts`)
      .set(alice)
      .send({ answer })
    expect(res.status).toBe(201)
    expect(res.body.feedback).toBeNull()
    const list = await request(app).get('/api/v1/interview/questions').set(alice)
    expect(list.body.progress.practised).toBe(1)
  })

  it('gives structured AI feedback and uses one AI answer from the allowance', async () => {
    const before = (await request(app).get('/api/v1/ai/usage').set(alice)).body.used
    const res = await request(app)
      .post(`/api/v1/interview/questions/${questionId}/attempts`)
      .set(alice)
      .send({ answer, withFeedback: true })
    expect(res.status).toBe(201)
    expect(res.body.feedback.summary.length).toBeGreaterThan(10)
    expect(Array.isArray(res.body.feedback.strengths)).toBe(true)
    expect(Array.isArray(res.body.feedback.improvements)).toBe(true)
    const after = (await request(app).get('/api/v1/ai/usage').set(alice)).body.used
    expect(after).toBe(before + 1)
  })

  it("keeps Alice's practice answers private", async () => {
    const aliceView = await request(app).get(`/api/v1/interview/questions/${questionId}`).set(alice)
    expect(aliceView.body.attempts).toHaveLength(2)
    const bobView = await request(app).get(`/api/v1/interview/questions/${questionId}`).set(bob)
    expect(bobView.body.attempts).toEqual([])
    expect(
      (
        await request(app)
          .delete(`/api/v1/interview/attempts/${aliceView.body.attempts[0].id}`)
          .set(bob)
      ).status,
    ).toBe(404)
  })

  it('refuses AI feedback beyond the allowance, without saving anything', async () => {
    const strict = createApp(
      createDeps(
        { ...config, ai: { ...config.ai, monthlyMessageLimit: 1 } },
        pino({ level: 'silent' }),
      ),
    )
    const res = await request(strict)
      .post(`/api/v1/interview/questions/${questionId}/attempts`)
      .set(alice)
      .send({ answer, withFeedback: true })
    expect(res.status).toBe(429)
    const view = await request(app).get(`/api/v1/interview/questions/${questionId}`).set(alice)
    expect(view.body.attempts).toHaveLength(2)
  })
})
