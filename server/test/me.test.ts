import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { serviceUnavailable } from '../src/lib/errors.ts'
import { buildTestApp, testUser, VALID_TOKEN } from './helpers.ts'

const auth = { Authorization: `Bearer ${VALID_TOKEN}` }

describe('authentication on /api/v1/me', () => {
  it('rejects requests without a token', async () => {
    const { app } = buildTestApp()
    const res = await request(app).get('/api/v1/me')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('unauthorized')
  })

  it.each([
    ['Basic dXNlcjpwYXNz'],
    ['Bearer'],
    ['Bearer not-a-jwt'],
    [`Bearer ${VALID_TOKEN} extra`],
  ])('rejects a malformed Authorization header: %s', async (header) => {
    const { app } = buildTestApp()
    const res = await request(app).get('/api/v1/me').set('Authorization', header)
    expect(res.status).toBe(401)
  })

  it('accepts the scheme name in any case, as HTTP requires', async () => {
    const { app } = buildTestApp()
    const res = await request(app).get('/api/v1/me').set('Authorization', `bearer ${VALID_TOKEN}`)
    expect(res.status).toBe(200)
  })

  it('rejects an invalid or expired token', async () => {
    const { app } = buildTestApp()
    const res = await request(app).get('/api/v1/me').set('Authorization', 'Bearer aaa.bbb.ccc')
    expect(res.status).toBe(401)
    expect(res.body.error.message).toMatch(/session has expired/i)
  })

  it('returns 503 (not 401) when the auth service is down', async () => {
    const { app } = buildTestApp({
      auth: {
        verifyAccessToken: async () => {
          throw serviceUnavailable()
        },
        getRoles: async () => [],
      },
    })
    const res = await request(app).get('/api/v1/me').set(auth)
    expect(res.status).toBe(503)
  })
})

describe('GET /api/v1/me', () => {
  it('returns the profile of the user identified by the token', async () => {
    const { app, calls } = buildTestApp()
    const res = await request(app).get('/api/v1/me').set(auth)
    expect(res.status).toBe(200)
    expect(res.body.fullName).toBe('Asha')
    expect(calls.getMe[0]).toMatchObject({ userId: testUser.id, accessToken: VALID_TOKEN })
  })
})

describe('PATCH /api/v1/me/profile', () => {
  it('rejects an invalid time zone', async () => {
    const { app, calls } = buildTestApp()
    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set(auth)
      .send({ timezone: 'Mars/Olympus' })
    expect(res.status).toBe(400)
    expect(calls.updateProfile).toHaveLength(0)
  })

  it('passes only allowed fields to the service', async () => {
    const { app, calls } = buildTestApp()
    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set(auth)
      .send({ fullName: 'Asha R', avatarUrl: 'https://evil.example/x.png', id: 'other-user' })
    expect(res.status).toBe(200)
    expect(calls.updateProfile[0]?.input).toEqual({ fullName: 'Asha R' })
  })
})

describe('PUT /api/v1/me/onboarding', () => {
  const answers = {
    lifeStage: 'college_student',
    primaryGoals: ['find_first_job'],
    targetCareer: 'Data analyst',
    preferredDomains: ['career'],
    skillLevel: 'beginner',
  }

  it('always uses the user ID from the token, never from the body', async () => {
    const { app, calls } = buildTestApp()
    const res = await request(app)
      .put('/api/v1/me/onboarding')
      .set(auth)
      .send({ ...answers, userId: 'someone-else', role: 'admin' })
    expect(res.status).toBe(200)
    expect(calls.saveOnboarding[0]?.ctx.userId).toBe(testUser.id)
    expect(calls.saveOnboarding[0]?.input).not.toHaveProperty('role')
    expect(calls.saveOnboarding[0]?.input).not.toHaveProperty('userId')
  })

  it('rejects incomplete answers', async () => {
    const { app } = buildTestApp()
    const res = await request(app)
      .put('/api/v1/me/onboarding')
      .set(auth)
      .send({ lifeStage: 'college_student' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('validation_failed')
  })
})

describe('DELETE /api/v1/me', () => {
  it('requires an explicit confirmation', async () => {
    const { app, calls } = buildTestApp()
    const res = await request(app).delete('/api/v1/me').set(auth).send({ confirm: 'yes' })
    expect(res.status).toBe(400)
    expect(calls.deleteAccount).toHaveLength(0)
  })

  it('deletes only the account identified by the token', async () => {
    const { app, calls } = buildTestApp()
    const res = await request(app)
      .delete('/api/v1/me')
      .set(auth)
      .send({ confirm: 'DELETE', userId: 'someone-else' })
    expect(res.status).toBe(204)
    expect(calls.deleteAccount).toEqual([testUser.id])
  })
})
