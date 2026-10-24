import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { buildTestApp } from './helpers.ts'

describe('health checks', () => {
  it('reports liveness and assigns a request ID', async () => {
    const { app } = buildTestApp()
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('reports ready when the database is reachable', async () => {
    const { app } = buildTestApp()
    const res = await request(app).get('/health/ready')
    expect(res.status).toBe(200)
    expect(res.body.checks.database).toBe('ok')
  })

  it('reports 503 when the database is unreachable', async () => {
    const { app } = buildTestApp({ checkDatabase: async () => false })
    const res = await request(app).get('/health/ready')
    expect(res.status).toBe(503)
    expect(res.body.checks.database).toBe('failing')
  })
})

describe('request IDs', () => {
  it('keeps a safe incoming request ID so logs can be traced across services', async () => {
    const { app } = buildTestApp()
    const res = await request(app).get('/health').set('X-Request-Id', 'lb-trace-12345678')
    expect(res.headers['x-request-id']).toBe('lb-trace-12345678')
  })

  it('replaces an unsafe incoming request ID', async () => {
    const { app } = buildTestApp()
    const res = await request(app).get('/health').set('X-Request-Id', '<script>alert(1)</script>')
    expect(res.headers['x-request-id']).not.toContain('<script>')
  })
})
