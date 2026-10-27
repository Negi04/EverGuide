/** Admin portal against the real database and Gemini (for knowledge-document uploads). */
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { pino } from 'pino'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.ts'
import { loadConfig } from '../../src/config/env.ts'
import { createDeps } from '../../src/deps.ts'
import { createGeminiEmbedder, createGenAI } from '../../src/lib/gemini.ts'
import { createAdminClient } from '../../src/lib/supabase.ts'
import { createRetriever } from '../../src/rag/retriever.ts'

if (existsSync('../.env')) process.loadEnvFile('../.env')
const config = loadConfig({ ...process.env, NODE_ENV: 'test' })
const admin = createAdminClient(config)
const app = createApp(createDeps(config, pino({ level: 'silent' })))
const stamp = Date.now()
const userIds: string[] = []
const slug = `admin-test-guide-${stamp}`

async function signIn(label: string, fullName: string, { isAdmin = false } = {}) {
  const email = `everguide-admin-${label}-${stamp}@example.com`
  const password = `Admin-${crypto.randomUUID()}`
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (created.error) throw created.error
  const id = created.data.user.id
  userIds.push(id)
  if (isAdmin) await admin.from('user_roles').insert({ user_id: id, role: 'admin' })
  const browser = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false },
  })
  const session = await browser.auth.signInWithPassword({ email, password })
  if (session.error) throw session.error
  return { id, email, headers: { Authorization: `Bearer ${session.data.session.access_token}` } }
}

let lead: Awaited<ReturnType<typeof signIn>>
let helper: Awaited<ReturnType<typeof signIn>>

beforeAll(async () => {
  lead = await signIn('lead', 'Lead Admin', { isAdmin: true })
  helper = await signIn('helper', 'Helper Person')
})

afterAll(async () => {
  await admin.from('knowledge_documents').delete().eq('slug', slug)
  await admin.from('audit_events').delete().in('actor_id', userIds)
  for (const id of userIds) await admin.auth.admin.deleteUser(id)
})

describe('overview', () => {
  it('shows real counts and twelve weeks of sign-ups', async () => {
    const res = await request(app).get('/api/v1/admin/overview').set(lead.headers)
    expect(res.status).toBe(200)
    expect(res.body.users.total).toBeGreaterThanOrEqual(2)
    expect(res.body.signupsByWeek).toHaveLength(12)
    expect(JSON.stringify(res.body)).not.toMatch(/journal/i)
  })
})

describe('users and roles', () => {
  it('lists and searches users with their roles', async () => {
    const res = await request(app).get(`/api/v1/admin/users?q=${stamp}`).set(lead.headers)
    const byEmail = Object.fromEntries(
      res.body.map((u: { email: string; roles: string[] }) => [u.email, u.roles]),
    )
    expect(Object.keys(byEmail)).toHaveLength(2)
    expect(byEmail[lead.email]).toEqual(expect.arrayContaining(['user', 'admin']))
    expect(byEmail[helper.email]).toEqual(['user'])
  })

  it('grants admin, refuses removing your own, and records both', async () => {
    const granted = await request(app)
      .post(`/api/v1/admin/users/${helper.id}/admin-role`)
      .set(lead.headers)
      .send({ admin: true })
    expect(granted.body.roles).toContain('admin')

    const self = await request(app)
      .post(`/api/v1/admin/users/${lead.id}/admin-role`)
      .set(lead.headers)
      .send({ admin: false })
    expect(self.status).toBe(409)

    const removed = await request(app)
      .post(`/api/v1/admin/users/${helper.id}/admin-role`)
      .set(lead.headers)
      .send({ admin: false })
    expect(removed.body.roles).toEqual(['user'])

    const log = await request(app).get('/api/v1/admin/audit-events?area=role').set(lead.headers)
    const mine = log.body.entries.filter((e: { targetId: string }) => e.targetId === helper.id)
    expect(mine.map((e: { action: string }) => e.action)).toEqual([
      'role.admin_removed',
      'role.admin_granted',
    ])
    expect(mine[0].actorName).toBe('Lead Admin')
  })
})

describe('knowledge documents', () => {
  const guide = `---
slug: ${slug}
title: Admin test guide ${stamp}
domain: career
source_name: EverGuide test
license: EverGuide original content
status: approved
---

## Zebra-striped spreadsheets

A test passage about colour-coding zebra-striped spreadsheets ${stamp}, which only this document mentions.
`
  let id = ''

  it('stores uploads as drafts, whatever the file says, so answers never use them unreviewed', async () => {
    const res = await request(app)
      .post('/api/v1/admin/knowledge-documents')
      .set(lead.headers)
      .send({ markdown: guide })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ slug, status: 'draft' })
    expect(res.body.chunks).toBeGreaterThan(0)
    id = res.body.id

    const retriever = createRetriever(
      admin,
      createGeminiEmbedder(createGenAI(config.ai.apiKey!), config.ai.embeddingModel),
      { matchCount: 5, minSimilarity: 0 },
    )
    const draftHits = await retriever.search(`zebra-striped spreadsheets ${stamp}`)
    expect(draftHits.map((h) => h.documentId)).not.toContain(id)

    const approved = await request(app)
      .patch(`/api/v1/admin/knowledge-documents/${id}`)
      .set(lead.headers)
      .send({ status: 'approved' })
    expect(approved.body.status).toBe('approved')
    const approvedHits = await retriever.search(`zebra-striped spreadsheets ${stamp}`)
    expect(approvedHits[0]?.documentId).toBe(id)

    // Archive straight away so real users' answers never cite the test document.
    await request(app)
      .patch(`/api/v1/admin/knowledge-documents/${id}`)
      .set(lead.headers)
      .send({ status: 'archived' })
  })

  it('explains front matter problems', async () => {
    const res = await request(app)
      .post('/api/v1/admin/knowledge-documents')
      .set(lead.headers)
      .send({ markdown: guide.replace('domain: career', 'domain: astrology') })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/domain/)
  })
})

describe('AI feedback review', () => {
  it('never includes who gave the feedback or what they asked', async () => {
    const res = await request(app).get('/api/v1/admin/ai-feedback').set(lead.headers)
    expect(res.status).toBe(200)
    for (const item of res.body) {
      expect(Object.keys(item).sort()).toEqual(
        ['answer', 'comment', 'createdAt', 'grounded', 'id', 'rating'].sort(),
      )
    }
  })
})
