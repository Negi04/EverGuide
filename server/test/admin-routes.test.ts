import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { AdminService } from '../src/services/admin-service.ts'
import { buildTestApp, testUser, unusedService, VALID_TOKEN } from './helpers.ts'

const auth = { Authorization: `Bearer ${VALID_TOKEN}` }
const targetId = '7b6a5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d'
const docId = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

function fakeAdmin(calls: unknown[] = []): AdminService {
  return {
    ...unusedService<AdminService>('admin'),
    overview: async () => ({}) as never,
    listUsers: async (q) => {
      calls.push(['listUsers', q])
      return []
    },
    setAdmin: async (actor, target, admin) => {
      calls.push(['setAdmin', actor, target, admin])
      return {} as never
    },
    uploadDocument: async (actor, markdown) => {
      calls.push(['upload', actor, markdown.length])
      return {} as never
    },
    setDocumentStatus: async (actor, id, status) => {
      calls.push(['status', actor, id, status])
      return {} as never
    },
    listFeedback: async (rating) => {
      calls.push(['feedback', rating])
      return []
    },
    auditLog: async (query) => {
      calls.push(['audit', query])
      return { entries: [], nextOffset: null }
    },
  }
}

function appWith(roles: ('user' | 'mentor' | 'admin')[], calls: unknown[] = []) {
  return buildTestApp({
    admin: fakeAdmin(calls),
    auth: {
      verifyAccessToken: async (t) => (t === VALID_TOKEN ? testUser : null),
      getRoles: async () => roles,
    },
  }).app
}

const routes: [string, string][] = [
  ['get', '/api/v1/admin/overview'],
  ['get', '/api/v1/admin/users'],
  ['post', `/api/v1/admin/users/${targetId}/admin-role`],
  ['get', '/api/v1/admin/knowledge-documents'],
  ['post', '/api/v1/admin/knowledge-documents'],
  ['patch', `/api/v1/admin/knowledge-documents/${docId}`],
  ['get', '/api/v1/admin/ai-feedback'],
  ['get', '/api/v1/admin/audit-events'],
]

describe('admin portal routes', () => {
  it('refuse visitors (401) and signed-in non-admins (403), everywhere', async () => {
    const app = appWith(['user', 'mentor'])
    for (const [method, path] of routes) {
      const agent = request(app) as unknown as Record<string, (p: string) => request.Test>
      expect((await agent[method]!(path)).status, `${method} ${path}`).toBe(401)
      expect((await agent[method]!(path).set(auth)).status, `${method} ${path}`).toBe(403)
    }
  })

  it('take the acting admin from the token, not the body', async () => {
    const calls: unknown[] = []
    await request(appWith(['user', 'admin'], calls))
      .post(`/api/v1/admin/users/${targetId}/admin-role`)
      .set(auth)
      .send({ admin: true, actorId: 'someone-else' })
    expect(calls).toEqual([['setAdmin', testUser.id, targetId, true]])
  })

  it('validate input', async () => {
    const app = appWith(['user', 'admin'])
    const role = await request(app)
      .post(`/api/v1/admin/users/${targetId}/admin-role`)
      .set(auth)
      .send({ admin: 'yes' })
    expect(role.status).toBe(400)
    const status = await request(app)
      .patch(`/api/v1/admin/knowledge-documents/${docId}`)
      .set(auth)
      .send({ status: 'published' })
    expect(status.status).toBe(400)
    const empty = await request(app)
      .post('/api/v1/admin/knowledge-documents')
      .set(auth)
      .send({ markdown: '' })
    expect(empty.status).toBe(400)
    expect(
      (await request(app).get('/api/v1/admin/audit-events?area=journal').set(auth)).status,
    ).toBe(400)
    expect(
      (await request(app).get('/api/v1/admin/ai-feedback?rating=great').set(auth)).status,
    ).toBe(400)
  })

  it('pass filters through', async () => {
    const calls: unknown[] = []
    const app = appWith(['user', 'admin'], calls)
    await request(app).get('/api/v1/admin/users?q=asha').set(auth)
    await request(app).get('/api/v1/admin/ai-feedback?rating=not_helpful').set(auth)
    await request(app).get('/api/v1/admin/audit-events?area=role&offset=50').set(auth)
    expect(calls).toEqual([
      ['listUsers', 'asha'],
      ['feedback', 'not_helpful'],
      ['audit', { area: 'role', offset: 50 }],
    ])
  })
})
