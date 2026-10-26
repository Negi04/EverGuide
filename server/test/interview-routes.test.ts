import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { InterviewService } from '../src/services/interview-service.ts'
import { buildTestApp, VALID_TOKEN } from './helpers.ts'

const auth = { Authorization: `Bearer ${VALID_TOKEN}` }
const questionId = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

function fakeInterview(calls: unknown[] = []): InterviewService {
  return {
    listQuestions: async (_ctx, filters) => {
      calls.push(filters)
      return { questions: [], progress: { practised: 0, total: 32 } }
    },
    getQuestion: async () => {
      throw new Error('not used')
    },
    setSaved: async (_ctx, _id, saved) => {
      calls.push({ saved })
    },
    createAttempt: async (_ctx, _id, input) => {
      calls.push(input)
      return {
        id: 'a1',
        questionId,
        answer: input.answer,
        feedback: null,
        createdAt: '2026-10-25T00:00:00Z',
      }
    },
    deleteAttempt: async () => {},
  }
}

describe('interview routes', () => {
  it('require a signed-in user', async () => {
    const { app } = buildTestApp({ interview: fakeInterview() })
    expect((await request(app).get('/api/v1/interview/questions')).status).toBe(401)
  })

  it('pass valid filters and reject unknown roles', async () => {
    const calls: unknown[] = []
    const { app } = buildTestApp({ interview: fakeInterview(calls) })
    await request(app).get('/api/v1/interview/questions?role=data_analyst&saved=true').set(auth)
    expect(calls[0]).toEqual({ role: 'data_analyst', category: undefined, savedOnly: true })
    expect(
      (await request(app).get('/api/v1/interview/questions?role=astronaut').set(auth)).status,
    ).toBe(400)
  })

  it('reject answers that are too short to practise with', async () => {
    const { app } = buildTestApp({ interview: fakeInterview() })
    const res = await request(app)
      .post(`/api/v1/interview/questions/${questionId}/attempts`)
      .set(auth)
      .send({ answer: 'Too short' })
    expect(res.status).toBe(400)
  })

  it('default to no AI feedback unless asked for', async () => {
    const calls: unknown[] = []
    const { app } = buildTestApp({ interview: fakeInterview(calls) })
    const answer = 'I would start by understanding what each manager needs and by when.'
    await request(app)
      .post(`/api/v1/interview/questions/${questionId}/attempts`)
      .set(auth)
      .send({ answer })
    expect(calls[0]).toEqual({ answer, withFeedback: false })
  })

  it('require a boolean when saving a question', async () => {
    const { app } = buildTestApp({ interview: fakeInterview() })
    const res = await request(app)
      .put(`/api/v1/interview/questions/${questionId}/saved`)
      .set(auth)
      .send({ saved: 'yes' })
    expect(res.status).toBe(400)
  })
})
