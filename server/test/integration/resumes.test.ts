/** Resume analyser against real Supabase Storage, RLS and Gemini. */
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { pino } from 'pino'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.ts'
import { loadConfig } from '../../src/config/env.ts'
import { createDeps } from '../../src/deps.ts'
import { createAdminClient } from '../../src/lib/supabase.ts'
import { makePdf, sampleResumeLines } from '../fixtures/make-pdf.ts'

if (existsSync('../.env')) process.loadEnvFile('../.env')
const config = loadConfig({ ...process.env, NODE_ENV: 'test' })
const admin = createAdminClient(config)
const app = createApp(createDeps(config, pino({ level: 'silent' })))
const userIds: string[] = []

async function signIn(label: string) {
  const email = `everguide-resume-${label}-${Date.now()}@example.com`
  const password = `Resume-${crypto.randomUUID()}`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error
  userIds.push(created.data.user.id)
  const browser = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false },
  })
  const session = await browser.auth.signInWithPassword({ email, password })
  if (session.error) throw session.error
  return {
    id: created.data.user.id,
    headers: { Authorization: `Bearer ${session.data.session.access_token}` },
  }
}

const filesFor = async (userId: string) =>
  (await admin.storage.from('resumes').list(userId)).data ?? []

const upload = (headers: Record<string, string>) =>
  request(app)
    .post('/api/v1/resumes')
    .set(headers)
    .set('Content-Type', 'application/pdf')
    .set('X-File-Name', 'Asha%20Rao%20CV.pdf')
    .send(makePdf([sampleResumeLines]))

let alice: Awaited<ReturnType<typeof signIn>>
let bob: Awaited<ReturnType<typeof signIn>>
let resumeId = ''

beforeAll(async () => {
  alice = await signIn('alice')
  bob = await signIn('bob')
})

afterAll(async () => {
  for (const id of userIds) {
    const files = await filesFor(id)
    if (files.length)
      await admin.storage.from('resumes').remove(files.map((f) => `${id}/${f.name}`))
    await admin.auth.admin.deleteUser(id)
  }
})

describe('resume analyser', () => {
  it('stores an uploaded PDF privately under the user’s folder', async () => {
    const res = await upload(alice.headers)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ fileName: 'Asha Rao CV.pdf', pageCount: 1 })
    resumeId = res.body.id
    expect((await filesFor(alice.id)).map((f) => f.name)).toEqual([`${resumeId}.pdf`])
  })

  it('analyses the resume against a job description', async () => {
    const res = await request(app)
      .post(`/api/v1/resumes/${resumeId}/analyses`)
      .set(alice.headers)
      .send({
        targetRole: 'Junior data analyst',
        jobDescription:
          'We need a junior data analyst with SQL, Excel and dashboard skills who can explain findings to non-technical teams.',
      })
    expect(res.status).toBe(201)
    expect(['strong', 'partial', 'limited']).toContain(res.body.report.alignment)
    expect(res.body.report.summary.length).toBeGreaterThan(10)
    expect(Array.isArray(res.body.report.suggestions)).toBe(true)
  })

  it("keeps Alice's resume private from Bob", async () => {
    expect((await request(app).get(`/api/v1/resumes/${resumeId}`).set(bob.headers)).status).toBe(
      404,
    )
    expect(
      (await request(app).post(`/api/v1/resumes/${resumeId}/analyses`).set(bob.headers).send({}))
        .status,
    ).toBe(404)
    expect((await request(app).delete(`/api/v1/resumes/${resumeId}`).set(bob.headers)).status).toBe(
      404,
    )
    expect((await request(app).get('/api/v1/resumes').set(bob.headers)).body).toEqual([])
    expect(await filesFor(alice.id)).toHaveLength(1)
  })

  it('rejects files that are not real PDFs', async () => {
    const res = await request(app)
      .post('/api/v1/resumes')
      .set(alice.headers)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4 not really'))
    expect(res.status).toBe(400)
  })

  it('deletes the file and its analyses', async () => {
    expect(
      (await request(app).delete(`/api/v1/resumes/${resumeId}`).set(alice.headers)).status,
    ).toBe(204)
    expect(await filesFor(alice.id)).toEqual([])
    const analyses = await admin.from('resume_analyses').select('id').eq('resume_id', resumeId)
    expect(analyses.data).toEqual([])
  })

  it('removes stored resumes when the account is deleted', async () => {
    await upload(bob.headers)
    expect(await filesFor(bob.id)).toHaveLength(1)
    const res = await request(app).delete('/api/v1/me').set(bob.headers).send({ confirm: 'DELETE' })
    expect(res.status).toBe(204)
    expect(await filesFor(bob.id)).toEqual([])
  })
})
