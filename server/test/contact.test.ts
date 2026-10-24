import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { buildTestApp } from './helpers.ts'

const valid = {
  name: '  Asha  ',
  email: 'asha@example.com',
  topic: 'mentorship',
  message: 'I would like to apply as a mentor for data careers.',
}

describe('POST /api/v1/contact', () => {
  it('validates input with the shared schema and reports each invalid field', async () => {
    const { app, calls } = buildTestApp()
    const res = await request(app).post('/api/v1/contact').send({ name: 'A', email: 'nope', topic: 'sales' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('validation_failed')
    const paths = res.body.error.details.map((d: { path: string }) => d.path)
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'topic', 'message']))
    expect(calls.contact).toHaveLength(0)
  })

  it('stores a valid message, trimmed, without unknown fields', async () => {
    const { app, calls } = buildTestApp()
    const res = await request(app)
      .post('/api/v1/contact')
      .send({ ...valid, status: 'closed', user_id: 'someone-else' })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ id: 'contact-1' })
    expect(calls.contact[0]).toEqual({ ...valid, name: 'Asha' })
  })

  it('has its own, stricter rate limit', async () => {
    const { app } = buildTestApp({
      rateLimits: { api: { windowMs: 60_000, limit: 100 }, contact: { windowMs: 60_000, limit: 2 } },
    })
    await request(app).post('/api/v1/contact').send(valid)
    await request(app).post('/api/v1/contact').send(valid)
    const res = await request(app).post('/api/v1/contact').send(valid)
    expect(res.status).toBe(429)
  })
})
