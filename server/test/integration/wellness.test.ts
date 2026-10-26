/** Journal and habits against the real database (RLS, composite keys, time zones). */
import { existsSync } from 'node:fs'
import { addDays, localDate } from '@everguide/shared'
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

async function signIn(label: string, timezone: string) {
  const email = `everguide-wellness-${label}-${Date.now()}@example.com`
  const password = `Wellness-${crypto.randomUUID()}`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error
  const id = created.data.user.id
  userIds.push(id)
  await admin.from('profiles').update({ timezone }).eq('id', id)
  const browser = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false },
  })
  const session = await browser.auth.signInWithPassword({ email, password })
  if (session.error) throw session.error
  return { id, headers: { Authorization: `Bearer ${session.data.session.access_token}` } }
}

let alice: Awaited<ReturnType<typeof signIn>>
let bob: Awaited<ReturnType<typeof signIn>>
// Pacific/Kiritimati is UTC+14: its "today" is often a day ahead of UTC.
const aliceZone = 'Pacific/Kiritimati'

beforeAll(async () => {
  alice = await signIn('alice', aliceZone)
  bob = await signIn('bob', 'America/Los_Angeles')
})

afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id)
})

describe('journal', () => {
  let entryId = ''

  it('writes, finds and pages entries', async () => {
    const created = await request(app)
      .post('/api/v1/journal')
      .set(alice.headers)
      .send({
        entryDate: '2026-10-26',
        mood: 2,
        title: 'Interview nerves',
        body: 'Felt anxious before the call.',
      })
    expect(created.status).toBe(201)
    entryId = created.body.id
    await request(app)
      .post('/api/v1/journal')
      .set(alice.headers)
      .send({ entryDate: '2026-10-25', body: 'A quiet walk by the lake.' })

    const found = await request(app).get('/api/v1/journal?q=anxious').set(alice.headers)
    expect(found.body.entries.map((e: { id: string }) => e.id)).toEqual([entryId])
    const byTitle = await request(app).get('/api/v1/journal?q=nerves').set(alice.headers)
    expect(byTitle.body.entries).toHaveLength(1)
    // Filter syntax in a search is treated as text, not as part of the query.
    const tricky = await request(app)
      .get(`/api/v1/journal?q=${encodeURIComponent('x),body.neq.(')}`)
      .set(alice.headers)
    expect(tricky.status).toBe(200)
    expect(tricky.body.entries).toHaveLength(0)

    const all = await request(app).get('/api/v1/journal').set(alice.headers)
    expect(all.body.entries.map((e: { entryDate: string }) => e.entryDate)).toEqual([
      '2026-10-26',
      '2026-10-25',
    ])
    expect(all.body.nextOffset).toBeNull()
  })

  it('is invisible and untouchable for anyone else', async () => {
    const list = await request(app).get('/api/v1/journal').set(bob.headers)
    expect(list.body.entries).toHaveLength(0)
    const edit = await request(app)
      .patch(`/api/v1/journal/${entryId}`)
      .set(bob.headers)
      .send({ body: 'changed' })
    expect(edit.status).toBe(404)
    const remove = await request(app).delete(`/api/v1/journal/${entryId}`).set(bob.headers)
    expect(remove.status).toBe(404)
  })

  it('edits and deletes your own entries', async () => {
    const edit = await request(app)
      .patch(`/api/v1/journal/${entryId}`)
      .set(alice.headers)
      .send({ mood: 4, title: '' })
    expect(edit.body).toMatchObject({ mood: 4, title: null })
    expect(
      (await request(app).delete(`/api/v1/journal/${entryId}`).set(alice.headers)).status,
    ).toBe(204)
  })
})

describe('habits', () => {
  let habitId = ''

  it("checks in for 'today' in the person's own time zone", async () => {
    const created = await request(app)
      .post('/api/v1/habits')
      .set(alice.headers)
      .send({ name: 'Walk' })
    expect(created.status).toBe(201)
    habitId = created.body.id

    const list = await request(app).get('/api/v1/habits').set(alice.headers)
    const today = localDate(aliceZone)
    expect(list.body.today).toBe(today)

    const yesterday = await request(app)
      .put(`/api/v1/habits/${habitId}/checkins/${addDays(today, -1)}`)
      .set(alice.headers)
    expect(yesterday.status).toBe(200)
    const done = await request(app)
      .put(`/api/v1/habits/${habitId}/checkins/${today}`)
      .set(alice.headers)
    expect(done.body.stats).toEqual({ streak: 2, streakUnit: 'day', thisWeek: expect.any(Number) })
    // Doing it twice is harmless.
    const again = await request(app)
      .put(`/api/v1/habits/${habitId}/checkins/${today}`)
      .set(alice.headers)
    expect(again.status).toBe(200)
    expect(again.body.checkins.filter((d: string) => d === today)).toHaveLength(1)

    const future = await request(app)
      .put(`/api/v1/habits/${habitId}/checkins/${addDays(today, 1)}`)
      .set(alice.headers)
    expect(future.status).toBe(400)

    const undo = await request(app)
      .delete(`/api/v1/habits/${habitId}/checkins/${today}`)
      .set(alice.headers)
    expect(undo.body.stats.streak).toBe(1)
  })

  it("can't be seen or checked by someone else", async () => {
    const list = await request(app).get('/api/v1/habits').set(bob.headers)
    expect(list.body.habits).toHaveLength(0)
    const today = localDate('America/Los_Angeles')
    const checkin = await request(app)
      .put(`/api/v1/habits/${habitId}/checkins/${today}`)
      .set(bob.headers)
    expect(checkin.status).toBe(404)
  })

  it('archived habits must be restored before checking in', async () => {
    await request(app)
      .patch(`/api/v1/habits/${habitId}`)
      .set(alice.headers)
      .send({ archived: true })
    const today = localDate(aliceZone)
    const res = await request(app)
      .put(`/api/v1/habits/${habitId}/checkins/${today}`)
      .set(alice.headers)
    expect(res.status).toBe(409)
  })

  it('streaks stay correct beyond the 1000-row API page', async () => {
    // 6 habits x 200 days = 1200 check-ins, more than one API page.
    const today = localDate(aliceZone)
    const habits = await admin
      .from('habits')
      .insert(Array.from({ length: 6 }, (_, i) => ({ user_id: alice.id, name: `Bulk ${i}` })))
      .select('id')
    if (habits.error) throw habits.error
    const rows = habits.data.flatMap((h) =>
      Array.from({ length: 200 }, (_, d) => ({
        habit_id: h.id,
        user_id: alice.id,
        checkin_date: addDays(today, -d),
      })),
    )
    const inserted = await admin.from('habit_checkins').insert(rows)
    if (inserted.error) throw inserted.error

    const list = await request(app).get('/api/v1/habits').set(alice.headers)
    const bulk = list.body.habits.filter((h: { name: string }) => h.name.startsWith('Bulk'))
    expect(bulk).toHaveLength(6)
    for (const habit of bulk) expect(habit.stats.streak).toBe(200)
  })
})
