/**
 * Cover images against real Cloudinary and Supabase. Skipped until the CLOUDINARY_*
 * variables are set. Everything uploaded here is deleted again afterwards.
 */
import { existsSync } from 'node:fs'
import type { UploadTicket } from '@everguide/shared'
import { createClient } from '@supabase/supabase-js'
import { pino } from 'pino'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.ts'
import { loadConfig } from '../../src/config/env.ts'
import { createDeps } from '../../src/deps.ts'
import { createImageStore } from '../../src/lib/cloudinary.ts'
import { createAdminClient } from '../../src/lib/supabase.ts'
import { makePng } from '../fixtures/make-png.ts'

if (existsSync('../.env')) process.loadEnvFile('../.env')
const config = loadConfig({ ...process.env, NODE_ENV: 'test' })
const admin = createAdminClient(config)
const images = config.cloudinary ? createImageStore(config.cloudinary) : null
const app = createApp(createDeps(config, pino({ level: 'silent' })))
const stamp = Date.now()
const userIds: string[] = []
const resourceIds: string[] = []
const uploaded: string[] = []

let editor: Record<string, string>

async function ticket(): Promise<UploadTicket> {
  const res = await request(app).post('/api/v1/admin/uploads/resource-image').set(editor)
  expect(res.status).toBe(200)
  return res.body
}

/** Upload the way the browser does: straight to Cloudinary with the signed fields. */
async function upload(t: UploadTicket, png: Buffer) {
  const form = new FormData()
  for (const [key, value] of Object.entries(t.fields)) form.set(key, value)
  form.set('file', new Blob([png], { type: 'image/png' }), 'cover.png')
  const response = await fetch(t.uploadUrl, { method: 'POST', body: form })
  const body = (await response.json()) as { public_id?: string; format?: string }
  if (body.public_id) uploaded.push(body.public_id)
  return { status: response.status, body }
}

const resource = {
  title: `Cover image test ${stamp}`,
  summary: 'A resource used to test cover images.',
  kind: 'article',
  domain: 'career',
  url: 'https://example.org/cover-test',
  sourceName: 'Example',
}

describe.skipIf(!images)('cover images with Cloudinary', () => {
  beforeAll(async () => {
    const email = `everguide-images-${stamp}@example.com`
    const password = `Images-${crypto.randomUUID()}`
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error) throw created.error
    userIds.push(created.data.user.id)
    await admin.from('user_roles').insert({ user_id: created.data.user.id, role: 'admin' })
    const browser = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { persistSession: false },
    })
    const session = await browser.auth.signInWithPassword({ email, password })
    if (session.error) throw session.error
    editor = { Authorization: `Bearer ${session.data.session.access_token}` }
  })

  afterAll(async () => {
    if (resourceIds.length) await admin.from('learning_resources').delete().in('id', resourceIds)
    for (const id of uploaded) await images?.destroy(id).catch(() => {})
    await admin.from('audit_events').delete().in('actor_id', userIds)
    for (const id of userIds) await admin.auth.admin.deleteUser(id)
  })

  let firstImage = ''
  let resourceId = ''

  it('uploads straight to Cloudinary with a signed ticket', async () => {
    const t = await ticket()
    const { status, body } = await upload(t, makePng(800, 450))
    expect(status).toBe(200)
    expect(body.public_id).toBe(t.fields.public_id)
    expect(body.format).toBe('png')
    firstImage = body.public_id!
  })

  it('rejects an upload whose signed values were changed', async () => {
    const t = await ticket()
    const tampered = {
      ...t,
      fields: { ...t.fields, public_id: `everguide/resources/${crypto.randomUUID()}` },
    }
    const { status } = await upload(tampered, makePng(800, 450))
    expect(status).toBe(401)
  })

  it('attaches a checked image and serves it resized', async () => {
    const res = await request(app)
      .post('/api/v1/admin/resources')
      .set(editor)
      .send({ ...resource, image: { publicId: firstImage, alt: 'A plain blue rectangle' } })
    expect(res.status).toBe(201)
    resourceId = res.body.id
    resourceIds.push(resourceId)
    expect(res.body.image).toMatchObject({ publicId: firstImage, alt: 'A plain blue rectangle' })
    expect(res.body.image.src).toMatch(
      /^https:\/\/res\.cloudinary\.com\/.+\/c_fill,g_auto,w_800,h_450,f_auto,q_auto\//,
    )
    const delivered = await fetch(res.body.image.src)
    expect(delivered.status).toBe(200)
    expect(delivered.headers.get('content-type')).toMatch(/^image\//)
  })

  it('refuses ids that were never uploaded', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/resources/${resourceId}`)
      .set(editor)
      .send({ image: { publicId: `everguide/resources/${crypto.randomUUID()}`, alt: 'Missing' } })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/wasn’t found/)
  })

  it('refuses images that are too small, and deletes them', async () => {
    const { body } = await upload(await ticket(), makePng(300, 169))
    const res = await request(app)
      .patch(`/api/v1/admin/resources/${resourceId}`)
      .set(editor)
      .send({ image: { publicId: body.public_id, alt: 'Too small' } })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/at least 400 pixels/)
    expect(await images!.inspect(body.public_id!)).toBeNull()
  })

  it('deletes the old image when it is replaced, and the new one with the resource', async () => {
    const { body } = await upload(await ticket(), makePng(1200, 675, [244, 184, 96]))
    const replaced = await request(app)
      .patch(`/api/v1/admin/resources/${resourceId}`)
      .set(editor)
      .send({ image: { publicId: body.public_id, alt: 'A plain gold rectangle' } })
    expect(replaced.status).toBe(200)
    expect(await images!.inspect(firstImage)).toBeNull()

    expect(
      (await request(app).delete(`/api/v1/admin/resources/${resourceId}`).set(editor)).status,
    ).toBe(204)
    expect(await images!.inspect(body.public_id!)).toBeNull()
  })
})
