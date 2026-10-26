/** Career roadmap against the real database (RLS) and the real knowledge base. */
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
  const email = `everguide-career-${label}-${Date.now()}@example.com`
  const password = `Career-${crypto.randomUUID()}`
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

beforeAll(async () => {
  alice = await signIn('alice')
  bob = await signIn('bob')
})

afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id)
})

describe('career roadmap', () => {
  let goalId = ''

  it('creates a goal with ordered milestones', async () => {
    const res = await request(app)
      .post('/api/v1/goals')
      .set(alice)
      .send({
        title: 'Build an emergency fund',
        description: 'Save three months of expenses and keep a monthly budget',
        category: 'finance',
        targetDate: '2027-06-30',
        milestones: [
          { title: 'Track spending for a month' },
          { title: 'Save one month of expenses' },
        ],
      })
    expect(res.status).toBe(201)
    goalId = res.body.id
    expect(res.body.milestones.map((m: { title: string }) => m.title)).toEqual([
      'Track spending for a month',
      'Save one month of expenses',
    ])
  })

  it('completes a milestone and appends new ones at the end', async () => {
    const goal = (await request(app).get('/api/v1/goals').set(alice)).body[0]
    const first = goal.milestones[0]
    const done = await request(app)
      .patch(`/api/v1/milestones/${first.id}`)
      .set(alice)
      .send({ completed: true })
    expect(done.body.milestones[0].completedAt).not.toBeNull()
    const added = await request(app)
      .post(`/api/v1/goals/${goalId}/milestones`)
      .set(alice)
      .send({ title: 'Automate savings' })
    expect(added.body.milestones.at(-1).title).toBe('Automate savings')
  })

  it('records when a goal is completed, and clears it when reopened', async () => {
    const completed = await request(app)
      .patch(`/api/v1/goals/${goalId}`)
      .set(alice)
      .send({ status: 'completed' })
    expect(completed.body.completedAt).not.toBeNull()
    const reopened = await request(app)
      .patch(`/api/v1/goals/${goalId}`)
      .set(alice)
      .send({ status: 'active' })
    expect(reopened.body.completedAt).toBeNull()
  })

  it("keeps Alice's roadmap private from Bob", async () => {
    expect((await request(app).get('/api/v1/goals').set(bob)).body).toEqual([])
    expect(
      (
        await request(app)
          .patch(`/api/v1/goals/${goalId}`)
          .set(bob)
          .send({ title: 'Hijacked goal' })
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .post(`/api/v1/goals/${goalId}/milestones`)
          .set(bob)
          .send({ title: 'Sneaky' })
      ).status,
    ).toBe(404)
    expect((await request(app).delete(`/api/v1/goals/${goalId}`).set(bob)).status).toBe(404)
  })

  it('recommends guides from the knowledge base that match the goal', async () => {
    const res = await request(app).get(`/api/v1/goals/${goalId}/recommendations`).set(alice)
    expect(res.status).toBe(200)
    const titles = res.body.map((r: { title: string }) => r.title)
    expect(titles.length).toBeGreaterThan(0)
    expect(titles).toEqual(expect.arrayContaining(['Saving, emergency funds and compound growth']))
  })

  it('deletes a goal with its milestones', async () => {
    expect((await request(app).delete(`/api/v1/goals/${goalId}`).set(alice)).status).toBe(204)
    const left = await admin.from('milestones').select('id').eq('goal_id', goalId)
    expect(left.data).toEqual([])
  })
})
