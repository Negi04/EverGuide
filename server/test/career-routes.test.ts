import type { Goal } from '@everguide/shared'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { CareerService } from '../src/services/career-service.ts'
import { buildTestApp, testUser, VALID_TOKEN } from './helpers.ts'

const auth = { Authorization: `Bearer ${VALID_TOKEN}` }
const goalId = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b'

const goal: Goal = {
  id: goalId,
  title: 'Become a data analyst',
  description: null,
  category: 'career',
  targetDate: '2027-03-31',
  status: 'active',
  completedAt: null,
  createdAt: '2026-10-25T00:00:00Z',
  milestones: [],
}

function fakeCareer(calls: unknown[] = []): CareerService {
  return {
    listGoals: async () => [goal],
    createGoal: async (ctx, input) => {
      calls.push({ ctx, input })
      return goal
    },
    updateGoal: async (_ctx, _id, patch) => {
      calls.push(patch)
      return goal
    },
    deleteGoal: async () => {},
    addMilestone: async () => goal,
    updateMilestone: async (_ctx, _id, patch) => {
      calls.push(patch)
      return goal
    },
    deleteMilestone: async () => goal,
    recommendations: async () => [],
  }
}

describe('career roadmap routes', () => {
  it('require a signed-in user', async () => {
    const { app } = buildTestApp({ career: fakeCareer() })
    expect((await request(app).get('/api/v1/goals')).status).toBe(401)
  })

  it('validate goals, including dates and milestone titles', async () => {
    const { app } = buildTestApp({ career: fakeCareer() })
    const res = await request(app)
      .post('/api/v1/goals')
      .set(auth)
      .send({ title: 'Go', targetDate: '31/03/2027', milestones: [{ title: '' }] })
    expect(res.status).toBe(400)
    const paths = res.body.error.details.map((d: { path: string }) => d.path)
    expect(paths).toEqual(expect.arrayContaining(['title', 'targetDate', 'milestones.0.title']))
  })

  it('create goals for the signed-in user only, ignoring a user_id in the body', async () => {
    const calls: { ctx: { userId: string }; input: object }[] = []
    const { app } = buildTestApp({ career: fakeCareer(calls) })
    const res = await request(app)
      .post('/api/v1/goals')
      .set(auth)
      .send({
        title: 'Become a data analyst',
        user_id: 'someone-else',
        milestones: [{ title: 'Learn SQL' }],
      })
    expect(res.status).toBe(201)
    expect(calls[0]?.ctx.userId).toBe(testUser.id)
    expect(calls[0]?.input).not.toHaveProperty('user_id')
  })

  it('only accept known statuses when updating a goal', async () => {
    const { app } = buildTestApp({ career: fakeCareer() })
    const res = await request(app)
      .patch(`/api/v1/goals/${goalId}`)
      .set(auth)
      .send({ status: 'done' })
    expect(res.status).toBe(400)
  })

  it('pass milestone completion through as a boolean', async () => {
    const calls: unknown[] = []
    const { app } = buildTestApp({ career: fakeCareer(calls) })
    const res = await request(app)
      .patch(`/api/v1/milestones/${goalId}`)
      .set(auth)
      .send({ completed: true })
    expect(res.status).toBe(200)
    expect(calls[0]).toEqual({ completed: true })
  })

  it('treat malformed IDs as not found', async () => {
    const { app } = buildTestApp({ career: fakeCareer() })
    expect((await request(app).delete('/api/v1/goals/not-an-id').set(auth)).status).toBe(404)
  })
})
