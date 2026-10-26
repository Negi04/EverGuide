/** Resource library against the real database: RLS for drafts, search, saving, audit. */
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { pino } from 'pino'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.ts'
import { loadConfig } from '../../src/config/env.ts'
import { createDeps } from '../../src/deps.ts'
import { createAdminClient } from '../../src/lib/supabase.ts'

if (existsSync('../.env')) process.loadEnvFile('../.env')
const config = loadConfig({ ...process.env, NODE_ENV: 'test' })
const admin = createAdminClient(config)
const app = createApp(createDeps(config, pino({ level: 'silent' })))
const stamp = Date.now()
const userIds: string[] = []
const resourceIds: string[] = []

async function signIn(label: string, { isAdmin = false } = {}) {
  const email = `everguide-resources-${label}-${stamp}@example.com`
  const password = `Resources-${crypto.randomUUID()}`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error
  const id = created.data.user.id
  userIds.push(id)
  if (isAdmin) await admin.from('user_roles').insert({ user_id: id, role: 'admin' })
  const browser = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false },
  })
  const session = await browser.auth.signInWithPassword({ email, password })
  if (session.error) throw session.error
  return { id, headers: { Authorization: `Bearer ${session.data.session.access_token}` } }
}

let editor: Awaited<ReturnType<typeof signIn>>
let reader: Awaited<ReturnType<typeof signIn>>

beforeAll(async () => {
  editor = await signIn('editor', { isAdmin: true })
  reader = await signIn('reader')
})

afterAll(async () => {
  if (resourceIds.length) await admin.from('learning_resources').delete().in('id', resourceIds)
  await admin.from('audit_events').delete().in('actor_id', userIds)
  for (const id of userIds) await admin.auth.admin.deleteUser(id)
})

const video = {
  title: `Budgeting basics ${stamp}`,
  summary: 'A short video on planning a first monthly budget.',
  kind: 'video',
  domain: 'finance',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  sourceName: 'Example channel',
  durationMinutes: 9,
}

describe('resource lifecycle', () => {
  let id = ''
  let slug = ''

  it('a new resource is a draft that visitors cannot see', async () => {
    const created = await request(app)
      .post('/api/v1/admin/resources')
      .set(editor.headers)
      .send(video)
    expect(created.status).toBe(201)
    id = created.body.id
    slug = created.body.slug
    resourceIds.push(id)
    expect(created.body).toMatchObject({
      status: 'draft',
      youtubeId: 'dQw4w9WgXcQ',
      publishedAt: null,
    })
    expect(slug).toBe(`budgeting-basics-${stamp}`)

    const listed = await request(app).get(`/api/v1/resources?q=${stamp}`)
    expect(listed.body.resources).toHaveLength(0)
    expect((await request(app).get(`/api/v1/resources/${slug}`)).status).toBe(404)
  })

  it('a second resource with the same title gets its own slug', async () => {
    const twin = await request(app)
      .post('/api/v1/admin/resources')
      .set(editor.headers)
      .send({ ...video, kind: 'article', url: 'https://example.org/budgeting' })
    resourceIds.push(twin.body.id)
    expect(twin.body.slug).toBe(`${slug}-2`)
    // Not a video, so no embed even if the link were to YouTube.
    expect(twin.body.youtubeId).toBeNull()
  })

  it('published resources are public and found by word forms', async () => {
    const published = await request(app)
      .patch(`/api/v1/admin/resources/${id}`)
      .set(editor.headers)
      .send({ status: 'published' })
    expect(published.body.status).toBe('published')
    expect(published.body.publishedAt).not.toBeNull()

    // "budgets" matches "Budgeting" through English stemming.
    const found = await request(app).get('/api/v1/resources?q=budgets&domain=finance')
    expect(found.body.resources.map((r: { id: string }) => r.id)).toContain(id)
    const wrongDomain = await request(app).get(`/api/v1/resources?q=${stamp}&domain=career`)
    expect(wrongDomain.body.resources).toHaveLength(0)
    expect((await request(app).get(`/api/v1/resources/${slug}`)).body.title).toBe(video.title)
  })

  it('readers can save it, and it disappears from their list when unpublished', async () => {
    expect(
      (await request(app).put(`/api/v1/resources/${id}/save`).set(reader.headers)).body,
    ).toEqual({ saved: true })
    // Saving twice is harmless.
    await request(app).put(`/api/v1/resources/${id}/save`).set(reader.headers)
    const saved = await request(app).get('/api/v1/me/saved-resources').set(reader.headers)
    expect(saved.body.map((r: { id: string }) => r.id)).toEqual([id])

    await request(app)
      .patch(`/api/v1/admin/resources/${id}`)
      .set(editor.headers)
      .send({ status: 'draft' })
    const after = await request(app).get('/api/v1/me/saved-resources').set(reader.headers)
    expect(after.body).toEqual([])
    const save = await request(app).put(`/api/v1/resources/${id}/save`).set(reader.headers)
    expect(save.status).toBe(404)
  })

  it('readers cannot manage content', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/resources/${id}`)
      .set(reader.headers)
      .send({ status: 'published' })
    expect(res.status).toBe(403)
  })

  it('every admin change is in the audit log, including deletions', async () => {
    expect(
      (await request(app).delete(`/api/v1/admin/resources/${id}`).set(editor.headers)).status,
    ).toBe(204)
    const { data } = await admin
      .from('audit_events')
      .select('action, target_id, metadata')
      .eq('actor_id', editor.id)
      .eq('target_id', id)
      .order('id')
    expect(data?.map((e) => e.action)).toEqual([
      'resource.created',
      'resource.published',
      'resource.unpublished',
      'resource.deleted',
    ])
    expect(data?.at(-1)?.metadata).toMatchObject({ slug })
  })
})
