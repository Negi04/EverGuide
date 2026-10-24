/**
 * End-to-end API tests against the real Supabase project in ../.env:
 * real token verification, real Row Level Security, real database constraints.
 * Creates one temporary user and deletes it (and its data) afterwards.
 *
 * Run with: npm run test:integration -w @everguide/server
 */
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

const email = `everguide-api-${Date.now()}@example.com`
const password = `Api-${crypto.randomUUID()}`
let userId = ''
let token = ''
const createdContactIds: string[] = []

beforeAll(async () => {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Integration Test' },
  })
  if (created.error) throw created.error
  userId = created.data.user.id

  const browser = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const session = await browser.auth.signInWithPassword({ email, password })
  if (session.error) throw session.error
  token = session.data.session.access_token
})

afterAll(async () => {
  if (createdContactIds.length) await admin.from('contact_messages').delete().in('id', createdContactIds)
  if (userId) await admin.auth.admin.deleteUser(userId)
})

describe('API against the real database', () => {
  it('is ready when the database is reachable', async () => {
    const res = await request(app).get('/health/ready')
    expect(res.status).toBe(200)
  })

  it('returns the new user created by the signup trigger', async () => {
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: userId,
      email,
      fullName: 'Integration Test',
      roles: ['user'],
      onboardingCompletedAt: null,
    })
  })

  it('rejects a token whose signature was tampered with', async () => {
    const [header, payload, signature = ''] = token.split('.')
    const flipped = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1)
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${header}.${payload}.${flipped}`)
    expect(res.status).toBe(401)
  })

  it('saves onboarding and keeps the first completion date on later edits', async () => {
    const answers = {
      lifeStage: 'recent_graduate',
      primaryGoals: ['find_first_job', 'prepare_for_interviews'],
      targetCareer: 'Frontend developer',
      preferredDomains: ['career', 'interview'],
      skillLevel: 'intermediate',
    }
    const first = await request(app).put('/api/v1/me/onboarding').set('Authorization', `Bearer ${token}`).send(answers)
    expect(first.status).toBe(200)
    expect(first.body.preferences.targetCareer).toBe('Frontend developer')
    expect(first.body.onboardingCompletedAt).not.toBeNull()

    const second = await request(app)
      .put('/api/v1/me/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...answers, skillLevel: 'advanced' })
    expect(second.body.preferences.skillLevel).toBe('advanced')
    expect(second.body.onboardingCompletedAt).toBe(first.body.onboardingCompletedAt)
  })

  it('updates the profile name and time zone', async () => {
    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Integration Renamed', timezone: 'Europe/London' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ fullName: 'Integration Renamed', timezone: 'Europe/London' })
  })

  it('stores contact messages through the service role', async () => {
    const res = await request(app).post('/api/v1/contact').send({
      name: 'Integration Test',
      email,
      topic: 'general',
      message: 'This is an automated integration test message.',
    })
    expect(res.status).toBe(201)
    createdContactIds.push(res.body.id)

    const stored = await admin.from('contact_messages').select('status').eq('id', res.body.id).single()
    expect(stored.data?.status).toBe('new')
  })
})
