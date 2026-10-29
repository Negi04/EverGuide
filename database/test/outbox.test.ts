import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness.ts'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
})

async function rejects(promise: Promise<unknown>): Promise<{ message: string; code?: string }> {
  try {
    await promise
  } catch (error) {
    return error as { message: string; code?: string }
  }
  throw new Error('Expected the query to fail, but it succeeded')
}

type Row = {
  id: number
  event_type: string
  dedupe_key: string
  payload: Record<string, unknown>
  status: string
  attempts: number
  next_attempt_at: Date
  last_error: string | null
}

const eventsFor = async (key: string) =>
  (
    await t.db.query<Row>(
      "select * from outbox_events where payload::text like '%' || $1 || '%' order by id",
      [key],
    )
  ).rows

/** Make every pending event "already delivered" so each test starts from a clean queue. */
const drain = () => t.db.query("update outbox_events set status = 'sent', sent_at = now()")

async function createMentor(name: string) {
  const id = await t.createUser(name)
  await t.db.query(
    `insert into mentor_profiles (user_id, headline, bio, years_experience, expertise)
     values ($1, 'Senior data analyst', $2, 6, '{data_analytics}')`,
    [id, 'I help people move into data analysis from other careers. '.repeat(2)],
  )
  return id
}

describe('events written by triggers', () => {
  it('a new account gets one welcome event with only a first name', async () => {
    const id = await t.createUser('Asha Rao')
    const [event, ...rest] = await eventsFor(id)
    expect(rest).toHaveLength(0)
    expect(event).toMatchObject({
      event_type: 'user.welcome',
      dedupe_key: `user.welcome:${id}`,
      status: 'pending',
    })
    expect(event!.payload).toEqual({ userId: id, firstName: 'Asha' })
  })

  it('a mentor application alerts admins', async () => {
    const id = await createMentor('Meera Iyer')
    const events = (await eventsFor(id)).map((e) => e.event_type)
    expect(events).toEqual(['user.welcome', 'admin.mentor_application'])
  })

  it('booking changes each produce one event, without the private topic', async () => {
    const mentor = await createMentor('Ravi Kumar')
    const mentee = await t.createUser('Neha Singh')
    const starts = new Date(Date.now() + 48 * 3_600_000)
    const booking = await t.db.query<{ id: string }>(
      `insert into bookings (mentor_id, mentee_id, starts_at, ends_at, topic)
       values ($1, $2, $3, $4, 'My private question about changing jobs') returning id`,
      [mentor, mentee, starts, new Date(starts.getTime() + 30 * 60_000)],
    )
    const id = booking.rows[0]!.id
    await t.db.query("update bookings set status = 'confirmed' where id = $1", [id])
    // Unrelated edits don't create events.
    await t.db.query(
      "update bookings set meeting_url = 'https://meet.example.com/x' where id = $1",
      [id],
    )
    await t.db.query(
      "update bookings set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day', status = 'requested' where id = $1",
      [id],
    )
    await t.db.query("update bookings set status = 'cancelled' where id = $1", [id])

    const events = await eventsFor(id)
    expect(events.map((e) => e.event_type)).toEqual([
      'booking.requested',
      'booking.confirmed',
      'booking.rescheduled',
      'booking.cancelled',
    ])
    expect(events[1]!.payload).toMatchObject({
      bookingId: id,
      mentorFirstName: 'Ravi',
      menteeFirstName: 'Neha',
      menteeTimezone: 'Asia/Kolkata',
    })
    expect(JSON.stringify(events)).not.toContain('private question')
  })

  it('a paid plan creates a receipt event, also when the server confirms it', async () => {
    const user = await t.createUser('Kiran Das')
    await t.asService(async (tx) => {
      await tx.query(
        "insert into billing_orders (user_id, plan, amount_paise, razorpay_order_id) values ($1, 'pro', 19900, 'order_Outbox1')",
        [user],
      )
      await tx.query("select confirm_plan_payment('order_Outbox1', 'pay_Outbox1')")
    })
    const receipt = (await eventsFor(user)).find((e) => e.event_type === 'payment.succeeded')
    expect(receipt?.payload).toMatchObject({
      plan: 'pro',
      amountPaise: 19900,
      firstName: 'Kiran',
      demo: true,
    })
  })

  it('nothing is queued for a change that was rolled back', async () => {
    const before = await t.db.query<{ n: number }>('select count(*)::int as n from outbox_events')
    await rejects(
      t.db.transaction(async (tx) => {
        await tx.query(
          'insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), \'x@example.com\', \'{"full_name":"Rolled Back"}\')',
        )
        throw new Error('abort')
      }),
    )
    const after = await t.db.query<{ n: number }>('select count(*)::int as n from outbox_events')
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n)
  })
})

describe('session reminders', () => {
  const remind = () =>
    t.asService(async (tx) => {
      const r = await tx.query<{ n: number }>('select enqueue_due_reminders() as n')
      return r.rows[0]!.n
    })

  it('reminds once about confirmed sessions starting within the hour, never cancelled ones', async () => {
    const mentor = await createMentor('Reminder Mentor')
    const mentee = await t.createUser('Reminder Mentee')
    const book = async (minutesAhead: number, status: string) => {
      const starts = new Date(Date.now() + minutesAhead * 60_000)
      const r = await t.db.query<{ id: string }>(
        `insert into bookings (mentor_id, mentee_id, starts_at, ends_at, topic, status)
         values ($1, $2, $3, $4, 'A topic for the session', $5) returning id`,
        [mentor, mentee, starts, new Date(starts.getTime() + 30 * 60_000), status],
      )
      return r.rows[0]!.id
    }
    const soon = await book(30, 'confirmed')
    const cancelled = await book(120 - 75, 'cancelled')
    const later = await book(180, 'confirmed')

    expect(await remind()).toBe(1)
    expect(await remind()).toBe(0)
    const types = async (id: string) => (await eventsFor(id)).map((e) => e.event_type)
    expect(await types(soon)).toContain('booking.reminder')
    expect(await types(cancelled)).not.toContain('booking.reminder')
    expect(await types(later)).not.toContain('booking.reminder')
  })
})

describe('who can see the outbox', () => {
  it('users and visitors cannot read it or call its functions', async () => {
    const user = await t.createUser('Curious')
    for (const run of [
      (sql: string) => t.asUser(user, (tx) => tx.query(sql)),
      (sql: string) => t.asAnon((tx) => tx.query(sql)),
    ]) {
      expect((await rejects(run('select * from outbox_events'))).message).toMatch(
        /permission denied/,
      )
      expect((await rejects(run('select * from claim_outbox_events(10, 60)'))).message).toMatch(
        /permission denied/,
      )
      expect(
        (await rejects(run("select enqueue_event('user.welcome', 'k', '{}')"))).message,
      ).toMatch(/permission denied/)
      expect((await rejects(run('select enqueue_due_reminders()'))).message).toMatch(
        /permission denied/,
      )
    }
  })
})

describe('delivery', () => {
  const claim = (limit = 10, lease = 60) =>
    t.asService(
      async (tx) =>
        (await tx.query<Row>('select * from claim_outbox_events($1, $2)', [limit, lease])).rows,
    )
  const finish = (id: number, ok: boolean, error: string | null = null, max = 8) =>
    t.asService((tx) =>
      tx.query('select finish_outbox_event($1, $2, $3, $4)', [id, ok, error, max]),
    )

  it('claims due events once; a claimed event is not handed out again', async () => {
    await drain()
    const user = await t.createUser('Claim Me')
    const first = await claim()
    expect(first.map((e) => e.payload.userId)).toEqual([user])
    expect(first[0]).toMatchObject({ status: 'sending', attempts: 1 })
    expect(await claim()).toEqual([])

    await finish(first[0]!.id, true)
    const [row] = await eventsFor(user)
    expect(row!.status).toBe('sent')
  })

  it('a lease that runs out (server crashed mid-send) makes the event claimable again', async () => {
    await drain()
    await t.createUser('Crash Test')
    const [claimed] = await claim(10, 60)
    await t.db.query(
      "update outbox_events set locked_until = now() - interval '1 second' where id = $1",
      [claimed!.id],
    )
    const [again] = await claim()
    expect(again!.id).toBe(claimed!.id)
    expect(again!.attempts).toBe(2)
  })

  it('failures back off, then park as failed after the last attempt', async () => {
    await drain()
    const user = await t.createUser('Flaky Hook')
    const [event] = await claim()
    await finish(event!.id, false, 'n8n returned 500', 2)
    let [row] = await eventsFor(user)
    expect(row).toMatchObject({ status: 'pending', last_error: 'n8n returned 500' })
    const wait = row!.next_attempt_at.getTime() - Date.now()
    expect(wait).toBeGreaterThan(20_000)
    expect(wait).toBeLessThanOrEqual(31_000)
    // Not due yet, so not claimable.
    expect(await claim()).toEqual([])

    await t.db.query('update outbox_events set next_attempt_at = now() where id = $1', [event!.id])
    const [second] = await claim()
    await finish(second!.id, false, 'still down', 2)
    ;[row] = await eventsFor(user)
    expect(row).toMatchObject({ status: 'failed', attempts: 2, last_error: 'still down' })
    expect(await claim()).toEqual([])
  })

  it('ignores an outcome for an event that is not being sent', async () => {
    await drain()
    const user = await t.createUser('Late Reply')
    const [event] = await claim()
    await finish(event!.id, true)
    await finish(event!.id, false, 'late failure report')
    const [row] = await eventsFor(user)
    expect(row!.status).toBe('sent')
  })
})

describe('retention', () => {
  it("deleting an account deletes the events that mention it, and its bookings' events", async () => {
    const mentor = await createMentor('Forget Mentor')
    const mentee = await t.createUser('Forget Mentee')
    const starts = new Date(Date.now() + 72 * 3_600_000)
    const booking = await t.db.query<{ id: string }>(
      `insert into bookings (mentor_id, mentee_id, starts_at, ends_at, topic)
       values ($1, $2, $3, $4, 'A topic for the session') returning id`,
      [mentor, mentee, starts, new Date(starts.getTime() + 30 * 60_000)],
    )
    const bookingId = booking.rows[0]!.id
    expect(await eventsFor(mentee)).toHaveLength(1)
    expect(await eventsFor(bookingId)).toHaveLength(1)

    await t.db.query('delete from auth.users where id = $1', [mentee])
    expect(await eventsFor(mentee)).toEqual([])
    expect(await eventsFor(bookingId)).toEqual([])
    // The mentor's own events stay.
    expect((await eventsFor(mentor)).length).toBeGreaterThan(0)

    await t.db.query('delete from auth.users where id = $1', [mentor])
    expect(await eventsFor(mentor)).toEqual([])
  })

  it('purges delivered events after 30 days and failed ones after 90, nothing newer', async () => {
    const user = await t.createUser('Old Events')
    const [event] = await eventsFor(user)
    const purge = () =>
      t.asService(
        async (tx) =>
          (await tx.query<{ n: number }>('select purge_outbox_events() as n')).rows[0]!.n,
      )

    await t.db.query(
      "update outbox_events set status = 'sent', sent_at = now() - interval '29 days' where id = $1",
      [event!.id],
    )
    await purge()
    expect(await eventsFor(user)).toHaveLength(1)

    await t.db.query(
      "update outbox_events set sent_at = now() - interval '31 days' where id = $1",
      [event!.id],
    )
    expect(await purge()).toBeGreaterThanOrEqual(1)
    expect(await eventsFor(user)).toEqual([])

    const other = await t.createUser('Failed Long Ago')
    const [failed] = await eventsFor(other)
    await t.db.query(
      "update outbox_events set status = 'failed', created_at = now() - interval '91 days' where id = $1",
      [failed!.id],
    )
    await purge()
    expect(await eventsFor(other)).toEqual([])
  })

  it('only the server can purge', async () => {
    const user = await t.createUser('Not Allowed')
    const error = await rejects(t.asUser(user, (tx) => tx.query('select purge_outbox_events()')))
    expect(error.message).toMatch(/permission denied/)
  })
})
