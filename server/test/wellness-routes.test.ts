import type { Habit, JournalEntry } from '@everguide/shared'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { searchPattern, type WellnessService } from '../src/services/wellness-service.ts'
import { buildTestApp, testUser, VALID_TOKEN } from './helpers.ts'

const auth = { Authorization: `Bearer ${VALID_TOKEN}` }
const entryId = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b'
const habitId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

const entry: JournalEntry = {
  id: entryId,
  entryDate: '2026-10-26',
  mood: 4,
  title: null,
  body: 'A calm day.',
  createdAt: '2026-10-26T10:00:00Z',
  updatedAt: '2026-10-26T10:00:00Z',
}
const habit: Habit = {
  id: habitId,
  name: 'Walk',
  targetPerWeek: 7,
  archived: false,
  createdAt: '2026-10-20T10:00:00Z',
  checkins: ['2026-10-26'],
  stats: { streak: 1, streakUnit: 'day', thisWeek: 1 },
}

function fakeWellness(calls: unknown[] = []): WellnessService {
  return {
    listJournal: async (_ctx, query) => {
      calls.push(query)
      return { entries: [entry], nextOffset: null }
    },
    createJournalEntry: async (ctx, input) => {
      calls.push({ ctx, input })
      return entry
    },
    updateJournalEntry: async (_ctx, _id, patch) => {
      calls.push(patch)
      return entry
    },
    deleteJournalEntry: async () => {},
    listHabits: async () => ({ today: '2026-10-26', habits: [habit] }),
    createHabit: async (_ctx, input) => {
      calls.push(input)
      return habit
    },
    updateHabit: async () => habit,
    deleteHabit: async () => {},
    setCheckin: async (_ctx, id, date, done) => {
      calls.push({ id, date, done })
      return habit
    },
  }
}

describe('journal routes', () => {
  it('require a signed-in user', async () => {
    const { app } = buildTestApp({ wellness: fakeWellness() })
    expect((await request(app).get('/api/v1/journal')).status).toBe(401)
    expect((await request(app).post('/api/v1/journal').send({})).status).toBe(401)
  })

  it('validate entries (text, date, mood)', async () => {
    const { app } = buildTestApp({ wellness: fakeWellness() })
    const res = await request(app)
      .post('/api/v1/journal')
      .set(auth)
      .send({ entryDate: '26/10/2026', body: '   ', mood: 9 })
    expect(res.status).toBe(400)
    const paths = res.body.error.details.map((d: { path: string }) => d.path)
    expect(paths).toEqual(expect.arrayContaining(['entryDate', 'body', 'mood']))
  })

  it('write entries for the signed-in user only', async () => {
    const calls: { ctx: { userId: string }; input: object }[] = []
    const { app } = buildTestApp({ wellness: fakeWellness(calls) })
    const res = await request(app)
      .post('/api/v1/journal')
      .set(auth)
      .send({ entryDate: '2026-10-26', body: 'A calm day.', user_id: 'someone-else' })
    expect(res.status).toBe(201)
    expect(calls[0]!.ctx.userId).toBe(testUser.id)
    expect(calls[0]!.input).not.toHaveProperty('user_id')
  })

  it('pass search and paging through, with sane limits', async () => {
    const calls: unknown[] = []
    const { app } = buildTestApp({ wellness: fakeWellness(calls) })
    expect((await request(app).get('/api/v1/journal?q=calm&offset=20').set(auth)).status).toBe(200)
    expect(calls[0]).toEqual({ q: 'calm', offset: 20 })
    expect((await request(app).get('/api/v1/journal?offset=-1').set(auth)).status).toBe(400)
  })

  it('treat a malformed id as not found', async () => {
    const { app } = buildTestApp({ wellness: fakeWellness() })
    const res = await request(app).delete('/api/v1/journal/not-a-uuid').set(auth)
    expect(res.status).toBe(404)
  })
})

describe('habit routes', () => {
  it('create habits with a default of every day', async () => {
    const calls: unknown[] = []
    const { app } = buildTestApp({ wellness: fakeWellness(calls) })
    const res = await request(app).post('/api/v1/habits').set(auth).send({ name: 'Walk' })
    expect(res.status).toBe(201)
    expect(calls[0]).toEqual({ name: 'Walk', targetPerWeek: 7 })
    const bad = await request(app)
      .post('/api/v1/habits')
      .set(auth)
      .send({ name: 'Walk', targetPerWeek: 8 })
    expect(bad.status).toBe(400)
  })

  it('PUT marks a day done and DELETE un-marks it', async () => {
    const calls: unknown[] = []
    const { app } = buildTestApp({ wellness: fakeWellness(calls) })
    const path = `/api/v1/habits/${habitId}/checkins/2026-10-26`
    expect((await request(app).put(path).set(auth)).status).toBe(200)
    expect((await request(app).delete(path).set(auth)).status).toBe(200)
    expect(calls).toEqual([
      { id: habitId, date: '2026-10-26', done: true },
      { id: habitId, date: '2026-10-26', done: false },
    ])
  })

  it('reject impossible dates', async () => {
    const { app } = buildTestApp({ wellness: fakeWellness() })
    const res = await request(app).put(`/api/v1/habits/${habitId}/checkins/2026-02-30`).set(auth)
    expect(res.status).toBe(400)
  })
})

describe('journal search pattern', () => {
  it('quotes plain text for a contains-search', () => {
    expect(searchPattern('calm day')).toBe('"%calm day%"')
  })

  it('drops characters that could change the filter or act as wildcards', () => {
    expect(searchPattern('a,body.neq.x)')).toBe('"%a body.neq.x%"')
    expect(searchPattern('100%_"\\')).toBe('"%100%"')
    expect(searchPattern(' ,(*) ')).toBeNull()
  })
})
