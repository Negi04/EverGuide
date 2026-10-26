/** The mentor marketplace end to end against the real database and booking functions. */
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
const userIds: string[] = []
const verificationIds: string[] = []

type TestUser = { id: string; headers: Record<string, string> }
async function signIn(label: string, fullName: string): Promise<TestUser> {
  const email = `everguide-mentor-${label}-${Date.now()}@example.com`
  const password = `Mentor-${crypto.randomUUID()}`
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
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

let mentor: TestUser
let mentee: TestUser
let rival: TestUser
let reviewer: TestUser
let applicationId = ''
let bookingId = ''
let slot: { startsAt: string; endsAt: string }

beforeAll(async () => {
  mentor = await signIn('mentor', 'Meera Mentor')
  mentee = await signIn('mentee', 'Rahul Mentee')
  rival = await signIn('rival', 'Riya Rival')
  reviewer = await signIn('admin', 'Arjun Admin')
  await admin.from('user_roles').insert({ user_id: reviewer.id, role: 'admin' })
})

afterAll(async () => {
  for (const id of verificationIds) await admin.from('audit_events').delete().eq('target_id', id)
  for (const id of userIds) await admin.auth.admin.deleteUser(id)
})

describe('mentor marketplace', () => {
  it('keeps a new application out of the public directory', async () => {
    const res = await request(app)
      .post('/api/v1/me/mentor-profile')
      .set(mentor.headers)
      .send({
        headline: 'Senior data analyst at a retail company',
        bio: 'I help people move into data analysis from support and operations roles, with practical portfolio advice.',
        jobTitle: 'Senior Data Analyst',
        yearsExperience: 7,
        expertise: ['data_analytics', 'career_switching'],
        languages: ['English', 'Hindi'],
        sessionMinutes: 30,
        evidenceUrl: 'https://www.linkedin.com/in/example',
      })
    expect(res.status).toBe(201)
    expect(res.body.verificationStatus).toBe('pending')
    expect((await request(app).get(`/api/v1/mentors/${mentor.id}`)).status).toBe(404)
    expect(
      (await request(app).get('/api/v1/mentors')).body.map((m: { id: string }) => m.id),
    ).not.toContain(mentor.id)
  })

  it('lets only admins see and decide applications', async () => {
    expect(
      (await request(app).get('/api/v1/admin/mentor-applications').set(mentee.headers)).status,
    ).toBe(403)
    const list = await request(app).get('/api/v1/admin/mentor-applications').set(reviewer.headers)
    const application = list.body.find((a: { mentorId: string }) => a.mentorId === mentor.id)
    expect(application.evidenceUrl).toBe('https://www.linkedin.com/in/example')
    applicationId = application.verificationId
    verificationIds.push(applicationId)

    const decide = await request(app)
      .post(`/api/v1/admin/mentor-applications/${applicationId}/decision`)
      .set(reviewer.headers)
      .send({ decision: 'verified', notes: 'Experience checked against LinkedIn.' })
    expect(decide.status).toBe(204)
    const again = await request(app)
      .post(`/api/v1/admin/mentor-applications/${applicationId}/decision`)
      .set(reviewer.headers)
      .send({ decision: 'rejected' })
    expect(again.status).toBe(409)
  })

  it('lists the verified mentor publicly and grants the mentor role', async () => {
    const profile = await request(app).get(`/api/v1/mentors/${mentor.id}`)
    expect(profile.status).toBe(200)
    expect(profile.body).toMatchObject({
      name: 'Meera Mentor',
      expertise: ['data_analytics', 'career_switching'],
    })
    const roles = await admin.from('user_roles').select('role').eq('user_id', mentor.id)
    expect(roles.data?.map((r) => r.role).sort()).toEqual(['mentor', 'user'])
    const notes = await request(app).get('/api/v1/notifications').set(mentor.headers)
    expect(notes.body.map((n: { type: string }) => n.type)).toContain('mentor.verified')
  })

  it('offers slots once availability is set, and rejects overlapping windows', async () => {
    const overlap = await request(app)
      .put('/api/v1/me/mentor-profile/availability')
      .set(mentor.headers)
      .send({
        windows: [
          { weekday: 1, startTime: '09:00', endTime: '12:00' },
          { weekday: 1, startTime: '11:00', endTime: '13:00' },
        ],
      })
    expect(overlap.status).toBe(409)
    const ok = await request(app)
      .put('/api/v1/me/mentor-profile/availability')
      .set(mentor.headers)
      .send({
        windows: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          weekday,
          startTime: '00:00',
          endTime: '23:30',
        })),
      })
    expect(ok.status).toBe(200)
    expect(ok.body.availability).toHaveLength(7)
    const slots = await request(app).get(`/api/v1/mentors/${mentor.id}/slots?days=3`)
    expect(slots.body.length).toBeGreaterThan(10)
    slot = slots.body[0]
  })

  it('books a slot and refuses the same slot for someone else', async () => {
    const res = await request(app).post('/api/v1/bookings').set(mentee.headers).send({
      mentorId: mentor.id,
      startsAt: slot.startsAt,
      topic: 'Moving from support into data analysis',
    })
    expect(res.status).toBe(201)
    bookingId = res.body.id
    const clash = await request(app).post('/api/v1/bookings').set(rival.headers).send({
      mentorId: mentor.id,
      startsAt: slot.startsAt,
      topic: 'I would like this exact time too',
    })
    expect(clash.status).toBe(409)
    expect(clash.body.error.message).toMatch(/not available/)
  })

  it('shows the booking to both sides with the other person’s name', async () => {
    const mentorView = (await request(app).get('/api/v1/bookings').set(mentor.headers)).body
    expect(mentorView[0]).toMatchObject({
      role: 'mentor',
      counterpart: { name: 'Rahul Mentee' },
      status: 'requested',
    })
    const menteeView = (await request(app).get('/api/v1/bookings').set(mentee.headers)).body
    expect(menteeView[0]).toMatchObject({
      role: 'mentee',
      counterpart: { name: 'Meera Mentor' },
      meetingUrl: null,
    })
    expect((await request(app).get('/api/v1/bookings').set(rival.headers)).body).toEqual([])
  })

  it('confirms with a meeting link that only then becomes visible', async () => {
    const wrongSide = await request(app)
      .post(`/api/v1/bookings/${bookingId}/respond`)
      .set(mentee.headers)
      .send({ accept: true, meetingUrl: 'https://meet.example/x' })
    expect(wrongSide.status).toBe(404)
    const confirm = await request(app)
      .post(`/api/v1/bookings/${bookingId}/respond`)
      .set(mentor.headers)
      .send({ accept: true, meetingUrl: 'https://meet.example/abc' })
    expect(confirm.status).toBe(204)
    const menteeView = (await request(app).get('/api/v1/bookings').set(mentee.headers)).body
    expect(menteeView[0]).toMatchObject({
      status: 'confirmed',
      meetingUrl: 'https://meet.example/abc',
    })
  })

  it('enforces the 12-hour cancellation rule and review eligibility', async () => {
    const cancel = await request(app)
      .post(`/api/v1/bookings/${bookingId}/cancel`)
      .set(mentee.headers)
      .send({})
    expect(cancel.status).toBe(409)
    expect(cancel.body.error.message).toMatch(/12 hours/)
    const review = await request(app)
      .post(`/api/v1/bookings/${bookingId}/review`)
      .set(mentee.headers)
      .send({ rating: 5 })
    expect(review.status).toBe(409)
  })

  it('notifies the mentee and lets them mark notifications read', async () => {
    const notes = await request(app).get('/api/v1/notifications').set(mentee.headers)
    expect(notes.body.map((n: { type: string }) => n.type)).toContain('booking.confirmed')
    expect(
      (await request(app).post('/api/v1/notifications/read').set(mentee.headers).send({})).status,
    ).toBe(204)
    const after = await request(app).get('/api/v1/notifications').set(mentee.headers)
    expect(after.body.every((n: { readAt: string | null }) => n.readAt !== null)).toBe(true)
  })
})
