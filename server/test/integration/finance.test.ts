/** Budgets and savings goals against the real database (RLS, ledger rules). */
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
  const email = `everguide-finance-${label}-${Date.now()}@example.com`
  const password = `Finance-${crypto.randomUUID()}`
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

describe('budgets', () => {
  let rentId = ''

  it('starts empty, then keeps income and items for the month', async () => {
    const empty = await request(app).get('/api/v1/budgets/2026-09').set(alice)
    expect(empty.body).toEqual({ month: '2026-09', exists: false, incomePaise: 0, items: [] })

    const income = await request(app)
      .put('/api/v1/budgets/2026-09')
      .set(alice)
      .send({ incomePaise: 5_000_000 })
    expect(income.status).toBe(200)
    const rent = await request(app)
      .post('/api/v1/budgets/2026-09/items')
      .set(alice)
      .send({ label: 'Rent', kind: 'need', plannedPaise: 2_000_000 })
    expect(rent.status).toBe(201)
    const withSip = await request(app)
      .post('/api/v1/budgets/2026-09/items')
      .set(alice)
      .send({ label: 'SIP', kind: 'saving', plannedPaise: 1_000_000, spentPaise: 1_000_000 })
    expect(withSip.body.incomePaise).toBe(5_000_000)
    expect(withSip.body.items.map((i: { label: string }) => i.label)).toEqual(['Rent', 'SIP'])
    rentId = withSip.body.items[0].id

    const spent = await request(app)
      .patch(`/api/v1/budget-items/${rentId}`)
      .set(alice)
      .send({ spentPaise: 1_999_999 })
    expect(spent.body.items[0].spentPaise).toBe(1_999_999)
  })

  it("other people can't see or change it", async () => {
    const theirs = await request(app).get('/api/v1/budgets/2026-09').set(bob)
    expect(theirs.body.exists).toBe(false)
    const edit = await request(app)
      .patch(`/api/v1/budget-items/${rentId}`)
      .set(bob)
      .send({ plannedPaise: 1 })
    expect(edit.status).toBe(404)
    const remove = await request(app).delete(`/api/v1/budget-items/${rentId}`).set(bob)
    expect(remove.status).toBe(404)
  })

  it('starts a month from last month’s plan, with spending reset', async () => {
    const copied = await request(app).post('/api/v1/budgets/2026-10/copy-previous').set(alice)
    expect(copied.status).toBe(200)
    expect(copied.body.incomePaise).toBe(5_000_000)
    expect(copied.body.items).toEqual([
      expect.objectContaining({ label: 'Rent', plannedPaise: 2_000_000, spentPaise: 0 }),
      expect.objectContaining({ label: 'SIP', plannedPaise: 1_000_000, spentPaise: 0 }),
    ])
    const again = await request(app).post('/api/v1/budgets/2026-10/copy-previous').set(alice)
    expect(again.status).toBe(409)
    const nothing = await request(app).post('/api/v1/budgets/2026-10/copy-previous').set(bob)
    expect(nothing.status).toBe(404)
  })

  it('rejects fractional paise and bad months', async () => {
    const fraction = await request(app)
      .post('/api/v1/budgets/2026-10/items')
      .set(alice)
      .send({ label: 'Tea', kind: 'want', plannedPaise: 10.5 })
    expect(fraction.status).toBe(400)
    expect((await request(app).get('/api/v1/budgets/2026-13').set(alice)).status).toBe(400)
  })
})

describe('savings goals', () => {
  let goalId = ''

  it('records deposits and withdrawals, keeping an explained balance', async () => {
    const goal = await request(app)
      .post('/api/v1/savings-goals')
      .set(alice)
      .send({ name: 'Emergency fund', targetPaise: 15_000_000, targetDate: '2027-06-30' })
    expect(goal.status).toBe(201)
    goalId = goal.body.id

    await request(app)
      .post(`/api/v1/savings-goals/${goalId}/entries`)
      .set(alice)
      .send({ amountPaise: 500_000, note: 'October' })
    const withdrawn = await request(app)
      .post(`/api/v1/savings-goals/${goalId}/entries`)
      .set(alice)
      .send({ amountPaise: -120_000, note: 'Phone repair' })
    expect(withdrawn.body.savedPaise).toBe(380_000)
    expect(withdrawn.body.entries.map((e: { amountPaise: number }) => e.amountPaise)).toEqual(
      expect.arrayContaining([500_000, -120_000]),
    )

    const overdraw = await request(app)
      .post(`/api/v1/savings-goals/${goalId}/entries`)
      .set(alice)
      .send({ amountPaise: -380_001 })
    expect(overdraw.status).toBe(409)
    expect(overdraw.body.error.message).toMatch(/can't withdraw more/i)
  })

  it("won't delete a deposit if that would take the goal below zero", async () => {
    const goal = (await request(app).get('/api/v1/savings-goals').set(alice)).body[0]
    const deposit = goal.entries.find((e: { amountPaise: number }) => e.amountPaise > 0)
    const res = await request(app).delete(`/api/v1/savings-entries/${deposit.id}`).set(alice)
    expect(res.status).toBe(409)
    const withdrawal = goal.entries.find((e: { amountPaise: number }) => e.amountPaise < 0)
    const removed = await request(app).delete(`/api/v1/savings-entries/${withdrawal.id}`).set(alice)
    expect(removed.body.savedPaise).toBe(500_000)
  })

  it("other people can't add to or see someone's goal", async () => {
    expect((await request(app).get('/api/v1/savings-goals').set(bob)).body).toEqual([])
    const add = await request(app)
      .post(`/api/v1/savings-goals/${goalId}/entries`)
      .set(bob)
      .send({ amountPaise: 100 })
    expect(add.status).toBe(404)
  })

  it('archived goals take no new entries until restored', async () => {
    await request(app).patch(`/api/v1/savings-goals/${goalId}`).set(alice).send({ archived: true })
    const res = await request(app)
      .post(`/api/v1/savings-goals/${goalId}/entries`)
      .set(alice)
      .send({ amountPaise: 100 })
    expect(res.status).toBe(409)
    const restored = await request(app)
      .patch(`/api/v1/savings-goals/${goalId}`)
      .set(alice)
      .send({ archived: false })
    expect(restored.body.archived).toBe(false)
  })
})
