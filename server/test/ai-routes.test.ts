import type { ChatStreamEvent } from '@everguide/shared'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { AppError } from '../src/lib/errors.ts'
import type { AiGuideService, Turn } from '../src/services/ai-guide-service.ts'
import { buildTestApp, VALID_TOKEN } from './helpers.ts'

const auth = { Authorization: `Bearer ${VALID_TOKEN}` }
const conversationId = '0b6c8f2e-2f3a-4c1d-9f50-1d2e3f4a5b6c'

function fakeGuide(turn: Partial<Turn> & { prepareError?: Error } = {}): AiGuideService {
  const summary = {
    id: conversationId,
    title: 'Budget',
    domain: 'finance' as const,
    lastMessageAt: '2026-10-24T00:00:00Z',
  }
  return {
    listConversations: async () => [summary],
    createConversation: async () => summary,
    getConversation: async () => ({ ...summary, messages: [] }),
    updateConversation: async () => summary,
    deleteConversation: async () => {},
    saveFeedback: async () => {},
    getUsage: async () => ({ used: 1, limit: 30, periodEnd: '2026-11-01T00:00:00.000Z' }),
    prepareTurn: async () => {
      if (turn.prepareError) throw turn.prepareError
      return {
        run:
          turn.run ??
          (async (emit) => {
            emit({ type: 'delta', text: 'Hello ' })
            emit({ type: 'delta', text: 'there.' })
          }),
      }
    },
  }
}

/** Parse a server-sent events body into its JSON payloads. */
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

describe('AI Guide routes', () => {
  it('answer 503 when no Gemini key is configured', async () => {
    const { app } = buildTestApp({ aiGuide: null })
    const res = await request(app).get('/api/v1/conversations').set(auth)
    expect(res.status).toBe(503)
  })

  it('require a signed-in user', async () => {
    const { app } = buildTestApp({ aiGuide: fakeGuide() })
    expect((await request(app).get('/api/v1/conversations')).status).toBe(401)
    expect((await request(app).get('/api/v1/ai/usage')).status).toBe(401)
  })

  it('treat malformed IDs as not found', async () => {
    const { app } = buildTestApp({ aiGuide: fakeGuide() })
    const res = await request(app).get('/api/v1/conversations/not-a-uuid').set(auth)
    expect(res.status).toBe(404)
  })

  it('validate the question before streaming', async () => {
    const { app } = buildTestApp({ aiGuide: fakeGuide() })
    const res = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set(auth)
      .send({ content: '   ' })
    expect(res.status).toBe(400)
    expect(res.headers['content-type']).toMatch(/json/)
  })

  it('stream the answer as server-sent events', async () => {
    const { app } = buildTestApp({ aiGuide: fakeGuide() })
    const res = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set(auth)
      .send({ content: 'How do I budget?' })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/event-stream/)
    expect(res.headers['cache-control']).toMatch(/no-cache/)
    expect(parseEvents(res.text)).toEqual([
      { type: 'delta', text: 'Hello ' },
      { type: 'delta', text: 'there.' },
    ])
  })

  it('return the allowance error as normal JSON, before any stream starts', async () => {
    const quota = new AppError(
      429,
      'quota_exceeded',
      'You’ve used all 30 AI Guide answers for this month.',
    )
    const { app } = buildTestApp({ aiGuide: fakeGuide({ prepareError: quota }) })
    const res = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set(auth)
      .send({ content: 'Hi' })
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('quota_exceeded')
  })

  it('turn failures during the stream into a friendly error event without internal details', async () => {
    const { app } = buildTestApp({
      aiGuide: fakeGuide({
        run: async () => {
          throw new Error('upstream 500 from generativelanguage.googleapis.com key=secret')
        },
      }),
    })
    const res = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set(auth)
      .send({ content: 'Hi' })
    const [event] = parseEvents(res.text)
    expect(event).toEqual({
      type: 'error',
      code: 'failed',
      message: expect.stringMatching(/try again/i),
    })
    expect(res.text).not.toMatch(/googleapis|secret/)
  })

  it('limit how fast answers can be requested', async () => {
    const { app } = buildTestApp({
      aiGuide: fakeGuide(),
      rateLimits: { aiAnswers: { windowMs: 60_000, limit: 2 } },
    })
    const send = () =>
      request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set(auth)
        .send({ content: 'Hi' })
    await send()
    await send()
    expect((await send()).status).toBe(429)
  })

  it('return usage for the signed-in user', async () => {
    const { app } = buildTestApp({ aiGuide: fakeGuide() })
    const res = await request(app).get('/api/v1/ai/usage').set(auth)
    expect(res.body).toEqual({ used: 1, limit: 30, periodEnd: '2026-11-01T00:00:00.000Z' })
  })
})
