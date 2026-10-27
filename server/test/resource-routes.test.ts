import type { AdminResource } from '@everguide/shared'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { AppError } from '../src/lib/errors.ts'
import type { ResourcesService } from '../src/services/resources-service.ts'
import { buildTestApp, testUser, VALID_TOKEN } from './helpers.ts'

const auth = { Authorization: `Bearer ${VALID_TOKEN}` }
const resourceId = '5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d'

const resource: AdminResource = {
  id: resourceId,
  slug: 'how-to-budget',
  title: 'How to budget',
  summary: 'A short guide to planning a monthly budget.',
  kind: 'article',
  domain: 'finance',
  url: 'https://example.org/budget',
  sourceName: 'Example',
  youtubeId: null,
  durationMinutes: 8,
  level: 'beginner',
  publishedAt: '2026-10-26T10:00:00Z',
  image: null,
  status: 'published',
  createdAt: '2026-10-26T10:00:00Z',
  updatedAt: '2026-10-26T10:00:00Z',
}

function fakeResources(calls: unknown[] = [], uploadsOn = true): ResourcesService {
  return {
    list: async (filters) => {
      calls.push(['list', filters])
      return { resources: [resource], nextOffset: null }
    },
    getBySlug: async (slug) => {
      calls.push(['getBySlug', slug])
      return resource
    },
    listSaved: async () => [resource],
    setSaved: async (ctx, id, saved) => {
      calls.push(['setSaved', ctx.userId, id, saved])
      return { saved }
    },
    adminList: async () => [resource],
    create: async (adminId, input) => {
      calls.push(['create', adminId, input])
      return resource
    },
    update: async (adminId, id, patch) => {
      calls.push(['update', adminId, id, patch])
      return resource
    },
    remove: async (adminId, id) => {
      calls.push(['remove', adminId, id])
    },
    signImageUpload: () => {
      if (!uploadsOn)
        throw new AppError(
          503,
          'service_unavailable',
          'Image uploads aren’t set up on this server.',
        )
      return {
        uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
        fields: { signature: 'x' },
      }
    },
  }
}

function appWith(roles: ('user' | 'mentor' | 'admin')[], calls: unknown[] = [], uploadsOn = true) {
  return buildTestApp({
    resources: fakeResources(calls, uploadsOn),
    auth: {
      verifyAccessToken: async (t) => (t === VALID_TOKEN ? testUser : null),
      getRoles: async () => roles,
    },
  }).app
}

const newResource = {
  title: 'How to budget',
  summary: 'A short guide to planning a monthly budget.',
  kind: 'article',
  domain: 'finance',
  url: 'https://example.org/budget',
  sourceName: 'Example',
}

describe('public library', () => {
  it('needs no sign-in and passes filters through', async () => {
    const calls: unknown[] = []
    const app = appWith(['user'], calls)
    const res = await request(app).get('/api/v1/resources?q=budget&domain=finance&kind=article')
    expect(res.status).toBe(200)
    expect(calls[0]).toEqual([
      'list',
      { q: 'budget', domain: 'finance', kind: 'article', offset: 0 },
    ])
    expect((await request(app).get('/api/v1/resources/how-to-budget')).status).toBe(200)
  })

  it('rejects unknown filters and treats odd slugs as not found', async () => {
    const app = appWith(['user'])
    expect((await request(app).get('/api/v1/resources?domain=astrology')).status).toBe(400)
    expect((await request(app).get('/api/v1/resources/Not_A_Slug')).status).toBe(404)
  })
})

describe('saved resources', () => {
  it('need a signed-in user and record who saved', async () => {
    const calls: unknown[] = []
    const app = appWith(['user'], calls)
    expect((await request(app).put(`/api/v1/resources/${resourceId}/save`)).status).toBe(401)
    expect((await request(app).get('/api/v1/me/saved-resources')).status).toBe(401)
    const saved = await request(app).put(`/api/v1/resources/${resourceId}/save`).set(auth)
    expect(saved.body).toEqual({ saved: true })
    const removed = await request(app).delete(`/api/v1/resources/${resourceId}/save`).set(auth)
    expect(removed.body).toEqual({ saved: false })
    expect(calls).toEqual([
      ['setSaved', testUser.id, resourceId, true],
      ['setSaved', testUser.id, resourceId, false],
    ])
  })
})

describe('admin content management', () => {
  it('is refused without the admin role', async () => {
    const app = appWith(['user', 'mentor'])
    expect((await request(app).get('/api/v1/admin/resources')).status).toBe(401)
    expect((await request(app).get('/api/v1/admin/resources').set(auth)).status).toBe(403)
    const create = await request(app).post('/api/v1/admin/resources').set(auth).send(newResource)
    expect(create.status).toBe(403)
  })

  it('creates drafts by default and records the admin', async () => {
    const calls: [string, string, object][] = []
    const app = appWith(['user', 'admin'], calls)
    const res = await request(app).post('/api/v1/admin/resources').set(auth).send(newResource)
    expect(res.status).toBe(201)
    expect(calls[0]![1]).toBe(testUser.id)
    expect(calls[0]![2]).toMatchObject({ status: 'draft', level: 'beginner' })
  })

  it('accepts https links only', async () => {
    const app = appWith(['user', 'admin'])
    for (const url of ['javascript:alert(1)', 'http://example.org', 'ftp://example.org/file']) {
      const res = await request(app)
        .post('/api/v1/admin/resources')
        .set(auth)
        .send({ ...newResource, url })
      expect(res.status, url).toBe(400)
    }
  })

  it('updates only the fields sent', async () => {
    const calls: [string, string, string, object][] = []
    const app = appWith(['user', 'admin'], calls)
    await request(app)
      .patch(`/api/v1/admin/resources/${resourceId}`)
      .set(auth)
      .send({ status: 'published' })
    expect(calls[0]![3]).toEqual({ status: 'published' })
  })
})

describe('image upload tickets', () => {
  it('are for admins only', async () => {
    const app = appWith(['user'])
    expect((await request(app).post('/api/v1/admin/uploads/resource-image')).status).toBe(401)
    expect((await request(app).post('/api/v1/admin/uploads/resource-image').set(auth)).status).toBe(
      403,
    )
  })

  it('are issued to admins', async () => {
    const res = await request(appWith(['user', 'admin']))
      .post('/api/v1/admin/uploads/resource-image')
      .set(auth)
    expect(res.status).toBe(200)
    expect(res.body.uploadUrl).toMatch(/^https:\/\/api\.cloudinary\.com\//)
  })

  it('say clearly when uploads are not configured', async () => {
    const res = await request(appWith(['user', 'admin'], [], false))
      .post('/api/v1/admin/uploads/resource-image')
      .set(auth)
    expect(res.status).toBe(503)
    expect(res.body.error.message).toMatch(/aren’t set up/)
  })

  it('reject image ids the server could not have issued', async () => {
    const res = await request(appWith(['user', 'admin']))
      .patch(`/api/v1/admin/resources/${resourceId}`)
      .set(auth)
      .send({ image: { publicId: 'someone/else/photo', alt: 'A photo' } })
    expect(res.status).toBe(400)
  })
})
