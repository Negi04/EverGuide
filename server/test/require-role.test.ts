import type { AppRole } from '@everguide/shared'
import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { requireAuth, requireRole } from '../src/middleware/auth.ts'
import { errorHandler } from '../src/middleware/errors.ts'
import type { AuthService } from '../src/services/auth-service.ts'
import { testUser, VALID_TOKEN } from './helpers.ts'

function appWithRoles(roles: AppRole[]) {
  const auth: AuthService = {
    verifyAccessToken: async (token) => (token === VALID_TOKEN ? testUser : null),
    getRoles: async () => roles,
  }
  const app = express()
  app.get('/admin-only', requireAuth(auth), requireRole(auth, 'admin'), (_req, res) => {
    res.json({ ok: true })
  })
  app.use(errorHandler)
  return app
}

describe('requireRole', () => {
  it('returns 401 without a token', async () => {
    const res = await request(appWithRoles(['admin'])).get('/admin-only')
    expect(res.status).toBe(401)
  })

  it('returns 403 for a signed-in user without the role', async () => {
    const res = await request(appWithRoles(['user'])).get('/admin-only').set('Authorization', `Bearer ${VALID_TOKEN}`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('forbidden')
  })

  it('allows a user who holds the role', async () => {
    const res = await request(appWithRoles(['user', 'admin']))
      .get('/admin-only')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
    expect(res.status).toBe(200)
  })
})
