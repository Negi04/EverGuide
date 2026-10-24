import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { ALLOWED_ORIGIN, buildTestApp } from './helpers.ts'

describe('security headers', () => {
  it('sets helmet headers and hides the framework', async () => {
    const { app } = buildTestApp()
    const res = await request(app).get('/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['strict-transport-security']).toBeDefined()
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})

describe('CORS', () => {
  it('allows the configured frontend origin', async () => {
    const { app } = buildTestApp()
    const res = await request(app).get('/health').set('Origin', ALLOWED_ORIGIN)
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
  })

  it('does not allow other origins', async () => {
    const { app } = buildTestApp()
    const res = await request(app).get('/health').set('Origin', 'https://evil.example')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('answers preflight requests for the Authorization header', async () => {
    const { app } = buildTestApp()
    const res = await request(app)
      .options('/api/v1/me')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization')
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i)
  })
})

describe('error responses', () => {
  it('returns a consistent JSON error for unknown routes', async () => {
    const { app } = buildTestApp()
    const res = await request(app).get('/api/v1/nope')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('not_found')
    expect(res.body.error.requestId).toBe(res.headers['x-request-id'])
  })

  it('rejects malformed JSON with 400', async () => {
    const { app } = buildTestApp()
    const res = await request(app)
      .post('/api/v1/contact')
      .set('Content-Type', 'application/json')
      .send('{"name":')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('invalid_json')
  })

  it('rejects bodies over 100 kB with 413', async () => {
    const { app } = buildTestApp()
    const res = await request(app)
      .post('/api/v1/contact')
      .send({ message: 'x'.repeat(110_000) })
    expect(res.status).toBe(413)
    expect(res.body.error.code).toBe('payload_too_large')
  })

  it('hides internal error details from the client', async () => {
    const { app } = buildTestApp({
      contact: {
        submit: async () => {
          throw new Error('connection to db.internal:5432 failed, password=hunter2')
        },
      },
    })
    const res = await request(app).post('/api/v1/contact').send({
      name: 'Asha',
      email: 'asha@example.com',
      topic: 'general',
      message: 'I would like to know about mentorship.',
    })
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('internal_error')
    expect(JSON.stringify(res.body)).not.toMatch(/hunter2|5432|stack/)
  })
})

describe('rate limiting', () => {
  it('returns 429 once the API limit is exceeded', async () => {
    const { app } = buildTestApp({
      rateLimits: { api: { windowMs: 60_000, limit: 2 }, contact: { windowMs: 60_000, limit: 10 } },
    })
    await request(app).get('/api/v1/me')
    await request(app).get('/api/v1/me')
    const res = await request(app).get('/api/v1/me')
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('rate_limited')
    expect(res.headers['ratelimit-policy']).toBeDefined()
  })
})
