import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness.ts'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
})

/** Expect a query to fail, returning the error so its message or code can be checked. */
async function rejects(promise: Promise<unknown>): Promise<{ message: string; code?: string }> {
  try {
    await promise
  } catch (error) {
    return error as { message: string; code?: string }
  }
  throw new Error('Expected the query to fail, but it succeeded')
}

type MentorOptions = {
  timezone?: string
  verified?: boolean
  minutes?: number
  windows?: [number, string, string][]
}

/** A mentor as the server would create one after an admin approved them. */
async function createMentor(name: string, options: MentorOptions = {}) {
  const id = await t.createUser(name, options.timezone ?? 'Asia/Kolkata')
  const verified = options.verified ?? true
  await t.db.query(
    `insert into mentor_profiles (user_id, headline, bio, years_experience, expertise, session_minutes,
                                  verification_status, verified_at)
     values ($1, 'Senior data analyst', $2, 6, '{data_analytics}', $3, $4, $5)`,
    [
      id,
      'I help people move into data analysis from other careers. '.repeat(2),
      options.minutes ?? 30,
      verified ? 'verified' : 'pending',
      verified ? new Date().toISOString() : null,
    ],
  )
  // By default: available all day, every day, so tests always find slots.
  for (const [weekday, start, end] of options.windows ??
    [1, 2, 3, 4, 5, 6, 7].map((d) => [d, '00:00', '23:30'] as [number, string, string])) {
    await t.db.query(
      'insert into mentor_availability (mentor_id, weekday, start_time, end_time) values ($1, $2, $3, $4)',
      [id, weekday, start, end],
    )
  }
  return id
}

async function openSlots(mentorId: string, days = 14) {
  const result = await t.db.query<{ starts_at: Date; ends_at: Date }>(
    'select starts_at, ends_at from mentor_open_slots($1, $2)',
    [mentorId, days],
  )
  return result.rows
}

const request = (
  menteeId: string,
  mentorId: string,
  startsAt: Date,
  topic = 'Moving into data analysis from support',
) =>
  t
    .asUser(menteeId, (tx) =>
      tx.query<{ id: string }>('select request_booking($1, $2, $3) as id', [
        mentorId,
        startsAt.toISOString(),
        topic,
      ]),
    )
    .then((r) => r.rows[0]!.id)

const HOUR = 3_600_000

describe('goals and milestones', () => {
  it('are private to their owner', async () => {
    const alice = await t.createUser('Alice')
    const bob = await t.createUser('Bob')
    const goal = await t.asUser(alice, (tx) =>
      tx.query<{ id: string }>(
        "insert into goals (user_id, title) values ($1, 'Become a data analyst') returning id",
        [alice],
      ),
    )
    const goalId = goal.rows[0]!.id
    await t.asUser(alice, (tx) =>
      tx.query("insert into milestones (goal_id, user_id, title) values ($1, $2, 'Learn SQL')", [
        goalId,
        alice,
      ]),
    )

    const bobSees = await t.asUser(bob, (tx) =>
      tx.query('select id from goals where id = $1', [goalId]),
    )
    expect(bobSees.rows).toEqual([])
    await t.asUser(bob, (tx) =>
      tx.query("update goals set title = 'Hacked' where id = $1", [goalId]),
    )
    await t.asUser(bob, (tx) => tx.query('delete from goals where id = $1', [goalId]))
    const still = await t.db.query<{ title: string }>('select title from goals where id = $1', [
      goalId,
    ])
    expect(still.rows[0]?.title).toBe('Become a data analyst')
  })

  it("can't attach a milestone to someone else's goal", async () => {
    const alice = await t.createUser('Alice')
    const bob = await t.createUser('Bob')
    const goal = await t.asUser(alice, (tx) =>
      tx.query<{ id: string }>(
        "insert into goals (user_id, title) values ($1, 'Alice goal') returning id",
        [alice],
      ),
    )
    const error = await rejects(
      t.asUser(bob, (tx) =>
        tx.query("insert into milestones (goal_id, user_id, title) values ($1, $2, 'Sneaky')", [
          goal.rows[0]!.id,
          bob,
        ]),
      ),
    )
    expect(error.code).toBe('23503') // foreign key: (goal, owner) pair doesn't exist
  })

  it('keep completed_at consistent with the status', async () => {
    const alice = await t.createUser('Alice')
    const error = await rejects(
      t.asUser(alice, (tx) =>
        tx
          .query<{ id: string }>(
            "insert into goals (user_id, title) values ($1, 'Done goal') returning id",
            [alice],
          )
          .then((r) =>
            tx.query("update goals set status = 'completed' where id = $1", [r.rows[0]!.id]),
          ),
      ),
    )
    expect(error.code).toBe('23514')
  })
})

describe('resumes and interview practice', () => {
  it("users can't create resume records or AI feedback themselves", async () => {
    const alice = await t.createUser('Alice')
    const resume = await rejects(
      t.asUser(alice, (tx) =>
        tx.query(
          "insert into resumes (user_id, file_name, storage_path, size_bytes, page_count, extracted_text) values ($1, 'cv.pdf', 'x/cv.pdf', 10, 1, 'text')",
          [alice],
        ),
      ),
    )
    expect(resume.code).toBe('42501')
  })

  it('creates a private bucket for resumes', async () => {
    const bucket = await t.db.query<{ public: boolean; allowed_mime_types: string[] }>(
      "select public, allowed_mime_types from storage.buckets where id = 'resumes'",
    )
    expect(bucket.rows[0]).toEqual({ public: false, allowed_mime_types: ['application/pdf'] })
  })

  it('only approved interview questions are visible', async () => {
    const alice = await t.createUser('Alice')
    await t.db
      .query(`insert into interview_questions (slug, category, role, difficulty, prompt, guidance, status) values
      ('approved-q', 'behavioural', 'general', 'foundation', 'Tell me about yourself.', 'Keep it to two minutes.', 'approved'),
      ('draft-q', 'behavioural', 'general', 'foundation', 'A draft question here.', 'Not reviewed yet.', 'draft')`)
    const visible = await t.asUser(alice, (tx) =>
      tx.query<{ slug: string }>('select slug from interview_questions order by slug'),
    )
    expect(visible.rows.map((r) => r.slug)).toEqual(['approved-q'])
  })
})

describe('mentor profiles', () => {
  it('only verified mentors are visible to other people', async () => {
    const verified = await createMentor('Verified Mentor')
    const pending = await createMentor('Pending Mentor', { verified: false })
    const visitor = await t.asAnon((tx) =>
      tx.query<{ user_id: string }>('select user_id from mentor_profiles where user_id = any($1)', [
        [verified, pending],
      ]),
    )
    expect(visitor.rows.map((r) => r.user_id)).toEqual([verified])
    const ownView = await t.asUser(pending, (tx) =>
      tx.query('select user_id from mentor_profiles where user_id = $1', [pending]),
    )
    expect(ownView.rows).toHaveLength(1)
  })

  it("mentors can edit their profile but can't verify themselves", async () => {
    const mentor = await createMentor('Self Verifier', { verified: false })
    await t.asUser(mentor, (tx) =>
      tx.query("update mentor_profiles set headline = 'Updated headline here' where user_id = $1", [
        mentor,
      ]),
    )
    const error = await rejects(
      t.asUser(mentor, (tx) =>
        tx.query(
          "update mentor_profiles set verification_status = 'verified', verified_at = now() where user_id = $1",
          [mentor],
        ),
      ),
    )
    expect(error.code).toBe('42501')
  })

  it('rejects overlapping availability windows on the same day', async () => {
    const mentor = await createMentor('Busy Mentor', { windows: [[1, '09:00', '12:00']] })
    const error = await rejects(
      t.asUser(mentor, (tx) =>
        tx.query(
          "insert into mentor_availability (mentor_id, weekday, start_time, end_time) values ($1, 1, '11:00', '13:00')",
          [mentor],
        ),
      ),
    )
    expect(error.code).toBe('23P01')
  })
})

describe('open slots', () => {
  it('are offered only for verified mentors', async () => {
    const pending = await createMentor('Pending', { verified: false })
    expect(await openSlots(pending)).toEqual([])
  })

  it('start at least 2 hours from now and match the session length', async () => {
    const mentor = await createMentor('Hourly', { minutes: 60 })
    const slots = await openSlots(mentor, 3)
    expect(slots.length).toBeGreaterThan(10)
    for (const slot of slots) {
      expect(slot.starts_at.getTime()).toBeGreaterThan(Date.now() + 2 * HOUR - 60_000)
      expect(slot.ends_at.getTime() - slot.starts_at.getTime()).toBe(HOUR)
    }
  })

  it("stay at the same local time in the mentor's time zone across a daylight-saving change", async () => {
    // US clocks go back on 1 November 2026, inside the next 14 days.
    const mentor = await createMentor('New York Mentor', {
      timezone: 'America/New_York',
      windows: [1, 2, 3, 4, 5, 6, 7].map((d) => [d, '09:00', '10:00'] as [number, string, string]),
    })
    const slots = await openSlots(mentor, 14)
    expect(slots.length).toBeGreaterThan(20)
    const localTimes = new Set(
      slots.map((s) =>
        s.starts_at.toLocaleTimeString('en-GB', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit',
        }),
      ),
    )
    expect([...localTimes].sort()).toEqual(['09:00', '09:30'])
    // …which means the UTC times differ before and after the change.
    const utcHours = new Set(slots.map((s) => s.starts_at.getUTCHours()))
    expect(utcHours.size).toBeGreaterThan(1)
  })
})

describe('booking a session', () => {
  it('creates a request, notifies the mentor and takes the slot off offer', async () => {
    const mentor = await createMentor('Mentor A')
    const mentee = await t.createUser('Mentee A')
    const [slot] = await openSlots(mentor)
    const bookingId = await request(mentee, mentor, slot!.starts_at)

    const booking = await t.db.query<{ status: string }>(
      'select status from bookings where id = $1',
      [bookingId],
    )
    expect(booking.rows[0]?.status).toBe('requested')
    const notes = await t.db.query<{ type: string }>(
      'select type from notifications where user_id = $1',
      [mentor],
    )
    expect(notes.rows.map((n) => n.type)).toContain('booking.requested')
    const remaining = await openSlots(mentor)
    expect(remaining.some((s) => s.starts_at.getTime() === slot!.starts_at.getTime())).toBe(false)
  })

  it('refuses a slot that someone else already requested', async () => {
    const mentor = await createMentor('Mentor B')
    const first = await t.createUser('First')
    const second = await t.createUser('Second')
    const [slot] = await openSlots(mentor)
    await request(first, mentor, slot!.starts_at)
    const error = await rejects(request(second, mentor, slot!.starts_at))
    expect(error.message).toMatch(/not available/)
  })

  it('the exclusion constraint itself blocks overlapping bookings (the race-condition guarantee)', async () => {
    const mentor = await createMentor('Mentor C')
    const one = await t.createUser('One')
    const two = await t.createUser('Two')
    const start = new Date(Date.now() + 48 * HOUR)
    const insert = (mentee: string, offsetMinutes: number) =>
      t.db.query(
        "insert into bookings (mentor_id, mentee_id, starts_at, ends_at, topic) values ($1, $2, $3, $4, 'A topic for the session')",
        [
          mentor,
          mentee,
          new Date(start.getTime() + offsetMinutes * 60_000),
          new Date(start.getTime() + (offsetMinutes + 30) * 60_000),
        ],
      )
    await insert(one, 0)
    // Even bypassing every function (as a buggy server might), an overlap is impossible.
    expect((await rejects(insert(two, 15))).code).toBe('23P01')
    // Back-to-back sessions are fine: ranges are [start, end).
    await insert(two, 30)
  })

  it('stops a mentee double-booking themselves with two mentors', async () => {
    const mentorOne = await createMentor('Mentor D1')
    const mentorTwo = await createMentor('Mentor D2')
    const mentee = await t.createUser('Busy mentee')
    const [slot] = await openSlots(mentorOne)
    await request(mentee, mentorOne, slot!.starts_at)
    const error = await rejects(request(mentee, mentorTwo, slot!.starts_at))
    expect(error.message).toMatch(/overlaps another of your sessions/)
  })

  it('refuses times outside availability, booking yourself, and anonymous callers', async () => {
    const mentor = await createMentor('Mentor E', { windows: [[3, '09:00', '10:00']] })
    const mentee = await t.createUser('Mentee E')
    const offHours = new Date(Date.now() + 50 * HOUR)
    expect((await rejects(request(mentee, mentor, offHours))).message).toMatch(/not available/)
    expect((await rejects(request(mentor, mentor, offHours))).message).toMatch(/yourself/)
    const anon = await rejects(
      t.asAnon((tx) =>
        tx.query('select request_booking($1, $2, $3)', [
          mentor,
          offHours.toISOString(),
          'A long enough topic',
        ]),
      ),
    )
    expect(anon.code).toBe('42501')
  })

  it("users can't write bookings directly", async () => {
    const mentor = await createMentor('Mentor F')
    const mentee = await t.createUser('Mentee F')
    const error = await rejects(
      t.asUser(mentee, (tx) =>
        tx.query(
          "insert into bookings (mentor_id, mentee_id, starts_at, ends_at, topic) values ($1, $2, now() + interval '1 day', now() + interval '25 hours', 'Direct insert attempt')",
          [mentor, mentee],
        ),
      ),
    )
    expect(error.code).toBe('42501')
  })
})

describe('responding, cancelling and rescheduling', () => {
  async function setup() {
    const mentor = await createMentor('Mentor R')
    const mentee = await t.createUser('Mentee R')
    const slots = await openSlots(mentor)
    return { mentor, mentee, slots }
  }

  it('only the mentor can confirm, and a meeting link is required', async () => {
    const { mentor, mentee, slots } = await setup()
    const id = await request(mentee, mentor, slots[10]!.starts_at)
    const respond = (user: string, accept: boolean, url: string | null) =>
      t.asUser(user, (tx) => tx.query('select respond_to_booking($1, $2, $3)', [id, accept, url]))

    expect((await rejects(respond(mentee, true, 'https://meet.example/x'))).message).toMatch(
      /not found/,
    )
    expect((await rejects(respond(mentor, true, 'http://insecure.example'))).message).toMatch(
      /https meeting link/,
    )
    await respond(mentor, true, 'https://meet.example/abc')
    const booking = await t.db.query<{ status: string; meeting_url: string }>(
      'select status, meeting_url from bookings where id = $1',
      [id],
    )
    expect(booking.rows[0]).toEqual({
      status: 'confirmed',
      meeting_url: 'https://meet.example/abc',
    })
  })

  it("mentees can't cancel a confirmed session in the last 12 hours, but mentors can with a reason", async () => {
    const { mentor, mentee, slots } = await setup()
    const soon = slots.find((s) => s.starts_at.getTime() < Date.now() + 10 * HOUR)!
    const id = await request(mentee, mentor, soon.starts_at)
    await t.asUser(mentor, (tx) =>
      tx.query('select respond_to_booking($1, true, $2)', [id, 'https://meet.example/soon']),
    )

    const menteeCancel = await rejects(
      t.asUser(mentee, (tx) => tx.query('select cancel_booking($1)', [id])),
    )
    expect(menteeCancel.message).toMatch(/12 hours/)
    const noReason = await rejects(
      t.asUser(mentor, (tx) => tx.query('select cancel_booking($1)', [id])),
    )
    expect(noReason.message).toMatch(/reason/)
    await t.asUser(mentor, (tx) => tx.query('select cancel_booking($1, $2)', [id, 'Unwell today']))
    const status = await t.db.query<{ status: string; cancelled_by: string }>(
      'select status, cancelled_by from bookings where id = $1',
      [id],
    )
    expect(status.rows[0]).toEqual({ status: 'cancelled', cancelled_by: mentor })
  })

  it('outsiders cannot cancel, and a cancelled slot is offered again', async () => {
    const { mentor, mentee, slots } = await setup()
    const outsider = await t.createUser('Outsider')
    const slot = slots[20]!
    const id = await request(mentee, mentor, slot.starts_at)
    expect(
      (await rejects(t.asUser(outsider, (tx) => tx.query('select cancel_booking($1)', [id]))))
        .message,
    ).toMatch(/not found/)
    await t.asUser(mentee, (tx) => tx.query('select cancel_booking($1)', [id]))
    const again = await openSlots(mentor)
    expect(again.some((s) => s.starts_at.getTime() === slot.starts_at.getTime())).toBe(true)
  })

  it('rescheduling moves the session (even into an overlapping time) and needs re-confirmation', async () => {
    const { mentor, mentee, slots } = await setup()
    const later = slots.filter((s) => s.starts_at.getTime() > Date.now() + 20 * HOUR)
    const id = await request(mentee, mentor, later[0]!.starts_at)
    await t.asUser(mentor, (tx) =>
      tx.query('select respond_to_booking($1, true, $2)', [id, 'https://meet.example/r']),
    )
    // The next slot is adjacent; moving there must not clash with the booking being moved.
    await t.asUser(mentee, (tx) =>
      tx.query('select reschedule_booking($1, $2)', [id, later[1]!.starts_at.toISOString()]),
    )
    const moved = await t.db.query<{ status: string; starts_at: Date; meeting_url: string | null }>(
      'select status, starts_at, meeting_url from bookings where id = $1',
      [id],
    )
    expect(moved.rows[0]?.status).toBe('requested')
    expect(moved.rows[0]?.starts_at.getTime()).toBe(later[1]!.starts_at.getTime())
    expect(moved.rows[0]?.meeting_url).toBeNull()
  })
})

describe('reviews', () => {
  async function pastSession(status = 'confirmed') {
    const mentor = await createMentor('Reviewed Mentor')
    const mentee = await t.createUser('Reviewer')
    const result = await t.db.query<{ id: string }>(
      `insert into bookings (mentor_id, mentee_id, starts_at, ends_at, status, topic)
       values ($1, $2, now() - interval '3 hours', now() - interval '150 minutes', $3, 'A past session topic') returning id`,
      [mentor, mentee, status],
    )
    return { mentor, mentee, bookingId: result.rows[0]!.id }
  }
  const review = (user: string, bookingId: string, rating = 5) =>
    t.asUser(user, (tx) =>
      tx.query('select submit_mentor_review($1, $2::smallint, $3)', [
        bookingId,
        rating,
        'Very helpful',
      ]),
    )

  it('can be left once by the mentee after a completed session, and are public', async () => {
    const { mentor, mentee, bookingId } = await pastSession()
    await review(mentee, bookingId)
    expect((await rejects(review(mentee, bookingId))).message).toMatch(/already reviewed/)
    const publicView = await t.asAnon((tx) =>
      tx.query<{ rating: number }>('select rating from mentor_reviews where mentor_id = $1', [
        mentor,
      ]),
    )
    expect(publicView.rows.map((r) => r.rating)).toEqual([5])
  })

  it('are refused for sessions that never happened or belong to someone else', async () => {
    const declined = await pastSession('declined')
    expect((await rejects(review(declined.mentee, declined.bookingId))).message).toMatch(
      /after it has taken place/,
    )
    const other = await pastSession()
    const stranger = await t.createUser('Stranger')
    expect((await rejects(review(stranger, other.bookingId))).message).toMatch(/not found/)
  })

  it('are refused before the session has ended', async () => {
    const mentor = await createMentor('Future Mentor')
    const mentee = await t.createUser('Eager reviewer')
    const [slot] = await openSlots(mentor)
    const id = await request(mentee, mentor, slot!.starts_at)
    await t.asUser(mentor, (tx) =>
      tx.query('select respond_to_booking($1, true, $2)', [id, 'https://meet.example/f']),
    )
    expect((await rejects(review(mentee, id))).message).toMatch(/after it has taken place/)
  })

  it("can't be written directly", async () => {
    const { mentor, mentee, bookingId } = await pastSession()
    const error = await rejects(
      t.asUser(mentee, (tx) =>
        tx.query(
          'insert into mentor_reviews (booking_id, mentor_id, mentee_id, rating) values ($1, $2, $3, 5)',
          [bookingId, mentor, mentee],
        ),
      ),
    )
    expect(error.code).toBe('42501')
  })
})
