import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { MentorService } from '../src/services/mentor-service.ts'
import { buildTestApp, testUser, VALID_TOKEN } from './helpers.ts'

const auth = { Authorization: `Bearer ${VALID_TOKEN}` }
const mentorId = '9c8b7a6f-5e4d-4c3b-8a2f-1e0d9c8b7a6f'

function fakeMentors(calls: unknown[] = []): MentorService {
  const record =
    (name: string) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args.slice(1)])
      return undefined as never
    }
  return {
    listMentors: async (filters) => {
      calls.push(['listMentors', filters])
      return []
    },
    getMentor: record('getMentor'),
    openSlots: async () => [],
    getOwnProfile: async () => null,
    apply: record('apply'),
    updateOwnProfile: record('updateOwnProfile'),
    replaceAvailability: record('replaceAvailability'),
    listBookings: async () => [],
    requestBooking: async (_ctx, input) => {
      calls.push(['requestBooking', input])
      return 'booking-1'
    },
    respond: record('respond'),
    cancel: record('cancel'),
    reschedule: record('reschedule'),
    review: record('review'),
    listApplications: async () => [],
    decide: async (adminId, ...rest) => {
      calls.push(['decide', adminId, ...rest])
    },
  }
}

function appWith(roles: ('user' | 'mentor' | 'admin')[], calls: unknown[] = []) {
  return buildTestApp({
    mentors: fakeMentors(calls),
    auth: {
      verifyAccessToken: async (t) => (t === VALID_TOKEN ? testUser : null),
      getRoles: async () => roles,
    },
  }).app
}

describe('mentor directory', () => {
  it('is public and validates filters', async () => {
    const calls: unknown[] = []
    const app = appWith(['user'], calls)
    expect((await request(app).get('/api/v1/mentors?expertise=data_analytics&q=sql')).status).toBe(
      200,
    )
    expect(calls[0]).toEqual(['listMentors', { expertise: 'data_analytics', q: 'sql' }])
    expect((await request(app).get('/api/v1/mentors?expertise=astrology')).status).toBe(400)
  })
})

describe('mentor applications', () => {
  it('require an https evidence link and valid expertise', async () => {
    const res = await request(appWith(['user']))
      .post('/api/v1/me/mentor-profile')
      .set(auth)
      .send({
        headline: 'Senior analyst',
        bio: 'short',
        yearsExperience: 5,
        expertise: ['astrology'],
        languages: ['English'],
        sessionMinutes: 20,
        evidenceUrl: 'http://x',
      })
    expect(res.status).toBe(400)
    const paths = res.body.error.details.map((d: { path: string }) => d.path)
    expect(paths).toEqual(
      expect.arrayContaining(['bio', 'expertise.0', 'sessionMinutes', 'evidenceUrl']),
    )
  })
})

describe('bookings', () => {
  it('validate the request before calling the database', async () => {
    const calls: unknown[] = []
    const app = appWith(['user'], calls)
    const bad = await request(app)
      .post('/api/v1/bookings')
      .set(auth)
      .send({ mentorId, startsAt: 'tomorrow 10am', topic: 'Hi' })
    expect(bad.status).toBe(400)
    expect(calls).toEqual([])
    const ok = await request(app)
      .post('/api/v1/bookings')
      .set(auth)
      .send({ mentorId, startsAt: '2030-01-01T10:00:00.000Z', topic: 'Moving into data analysis' })
    expect(ok.status).toBe(201)
  })

  it('require a meeting link to confirm', async () => {
    const res = await request(appWith(['mentor']))
      .post(`/api/v1/bookings/${mentorId}/respond`)
      .set(auth)
      .send({ accept: true })
    expect(res.status).toBe(400)
  })

  it('limit how many booking requests can be made', async () => {
    const { app } = buildTestApp({
      mentors: fakeMentors(),
      rateLimits: { bookings: { windowMs: 60_000, limit: 1 } },
    })
    const send = () =>
      request(app).post('/api/v1/bookings').set(auth).send({
        mentorId,
        startsAt: '2030-01-01T10:00:00.000Z',
        topic: 'Moving into data analysis',
      })
    await send()
    expect((await send()).status).toBe(429)
  })
})

describe('admin verification', () => {
  it('is forbidden for users who are not admins', async () => {
    const app = appWith(['user', 'mentor'])
    expect((await request(app).get('/api/v1/admin/mentor-applications').set(auth)).status).toBe(403)
    const decide = await request(app)
      .post(`/api/v1/admin/mentor-applications/${mentorId}/decision`)
      .set(auth)
      .send({ decision: 'verified' })
    expect(decide.status).toBe(403)
  })

  it('records the deciding admin from the token', async () => {
    const calls: unknown[][] = []
    const app = appWith(['user', 'admin'], calls)
    const res = await request(app)
      .post(`/api/v1/admin/mentor-applications/${mentorId}/decision`)
      .set(auth)
      .send({ decision: 'verified', notes: 'Checked LinkedIn and portfolio.' })
    expect(res.status).toBe(204)
    expect(calls[0]?.slice(0, 5)).toEqual([
      'decide',
      testUser.id,
      mentorId,
      'verified',
      'Checked LinkedIn and portfolio.',
    ])
  })
})
