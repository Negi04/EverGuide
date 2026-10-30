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

let counter = 0
/** A fake Razorpay id with the right shape. */
const rzp = (prefix: 'order' | 'pay') => `${prefix}_Test${String(++counter).padStart(10, '0')}`

/** Records an order the way the server does after Razorpay creates it. */
async function createOrder(userId: string, plan: 'pro' | 'premium', amountPaise = 19900) {
  const orderId = rzp('order')
  await t.asService((tx) =>
    tx.query(
      'insert into billing_orders (user_id, plan, amount_paise, razorpay_order_id) values ($1, $2, $3, $4)',
      [userId, plan, amountPaise, orderId],
    ),
  )
  return orderId
}

type Period = { id: string; plan: string; starts_at: Date; ends_at: Date }

async function confirm(orderId: string, paymentId: string, amount: number | null = null) {
  const r = await t.asService((tx) =>
    tx.query<Period>('select * from confirm_plan_payment($1, $2, $3)', [
      orderId,
      paymentId,
      amount,
    ]),
  )
  return r.rows[0]!
}

describe('who can write billing data', () => {
  it("a user can't create an order or give themselves a plan", async () => {
    const user = await t.createUser('Buyer')
    const order = await rejects(
      t.asUser(user, (tx) =>
        tx.query(
          "insert into billing_orders (user_id, plan, amount_paise, razorpay_order_id) values ($1, 'pro', 1, 'order_Fake')",
          [user],
        ),
      ),
    )
    expect(order.message).toMatch(/permission denied/)

    const orderId = await createOrder(user, 'pro')
    const id = await t.asService(async (tx) => {
      const r = await tx.query<{ id: string }>(
        'select id from billing_orders where razorpay_order_id = $1',
        [orderId],
      )
      return r.rows[0]!.id
    })
    const period = await rejects(
      t.asUser(user, (tx) =>
        tx.query(
          "insert into plan_subscriptions (user_id, plan, order_id, starts_at, ends_at) values ($1, 'premium', $2, now(), now() + interval '1 year')",
          [user, id],
        ),
      ),
    )
    expect(period.message).toMatch(/permission denied/)

    const markPaid = await rejects(
      t.asUser(user, (tx) =>
        tx.query("update billing_orders set status = 'paid' where razorpay_order_id = $1", [
          orderId,
        ]),
      ),
    )
    expect(markPaid.message).toMatch(/permission denied/)

    for (const call of [
      "select confirm_plan_payment('order_X', 'pay_X')",
      "select apply_payment_event('evt', 'order.paid', 'order_X', 'pay_X', 1)",
    ]) {
      const error = await rejects(t.asUser(user, (tx) => tx.query(call)))
      expect(error.message).toMatch(/permission denied/)
    }
  })

  it('users see only their own orders and plans; the event log is server-only', async () => {
    const buyer = await t.createUser('Buyer')
    const other = await t.createUser('Other')
    const orderId = await createOrder(buyer, 'pro')
    await confirm(orderId, rzp('pay'))

    const own = await t.asUser(buyer, (tx) => tx.query('select * from plan_subscriptions'))
    expect(own.rows).toHaveLength(1)
    const theirs = await t.asUser(other, (tx) =>
      tx.query('select * from billing_orders where user_id = $1', [buyer]),
    )
    expect(theirs.rows).toHaveLength(0)

    const events = await rejects(t.asUser(buyer, (tx) => tx.query('select * from payment_events')))
    expect(events.message).toMatch(/permission denied/)
    const anon = await rejects(t.asAnon((tx) => tx.query('select * from billing_orders')))
    expect(anon.message).toMatch(/permission denied/)
  })
})

describe('confirm_plan_payment', () => {
  it('gives one month of the plan and marks the order paid', async () => {
    const user = await t.createUser('Buyer')
    const orderId = await createOrder(user, 'premium', 49900)
    const paymentId = rzp('pay')
    const period = await confirm(orderId, paymentId, 49900)

    expect(period.plan).toBe('premium')
    const days = (period.ends_at.getTime() - period.starts_at.getTime()) / 86_400_000
    expect(days).toBeGreaterThanOrEqual(28)
    expect(days).toBeLessThanOrEqual(31)

    const order = await t.asService((tx) =>
      tx.query<{ status: string; razorpay_payment_id: string }>(
        'select status, razorpay_payment_id from billing_orders where razorpay_order_id = $1',
        [orderId],
      ),
    )
    expect(order.rows[0]).toEqual({ status: 'paid', razorpay_payment_id: paymentId })
  })

  it('is idempotent: confirming the same payment again creates nothing new', async () => {
    const user = await t.createUser('Buyer')
    const orderId = await createOrder(user, 'pro')
    const paymentId = rzp('pay')
    const first = await confirm(orderId, paymentId)
    const second = await confirm(orderId, paymentId)
    expect(second.id).toBe(first.id)

    const count = await t.asService((tx) =>
      tx.query<{ n: number }>(
        'select count(*)::int as n from plan_subscriptions where user_id = $1',
        [user],
      ),
    )
    expect(count.rows[0]!.n).toBe(1)
  })

  it('refuses a different payment for an order that is already paid', async () => {
    const user = await t.createUser('Buyer')
    const orderId = await createOrder(user, 'pro')
    await confirm(orderId, rzp('pay'))
    const error = await rejects(confirm(orderId, rzp('pay')))
    expect(error.message).toMatch(/already paid/)
  })

  it('refuses a payment whose amount differs from the order', async () => {
    const user = await t.createUser('Buyer')
    const orderId = await createOrder(user, 'pro', 19900)
    const error = await rejects(confirm(orderId, rzp('pay'), 100))
    expect(error.message).toMatch(/amount/)
  })

  it('refuses an order it has never seen', async () => {
    const error = await rejects(confirm('order_Unknown0001', rzp('pay')))
    expect(error.code).toBe('P0002')
  })

  it('a second month of the same plan starts when the first ends', async () => {
    const user = await t.createUser('Buyer')
    const first = await confirm(await createOrder(user, 'pro'), rzp('pay'))
    const second = await confirm(await createOrder(user, 'pro'), rzp('pay'))
    expect(second.starts_at.getTime()).toBe(first.ends_at.getTime())

    // A different plan starts straight away instead of waiting.
    const premium = await confirm(await createOrder(user, 'premium', 49900), rzp('pay'))
    expect(premium.starts_at.getTime()).toBeLessThan(first.ends_at.getTime())
  })
})

describe('apply_payment_event', () => {
  const apply = (
    eventId: string,
    type: string,
    orderId: string,
    paymentId: string,
    amount = 19900,
  ) =>
    t.asService(async (tx) => {
      const r = await tx.query<{ applied: boolean }>(
        'select apply_payment_event($1, $2, $3, $4, $5) as applied',
        [eventId, type, orderId, paymentId, amount],
      )
      return r.rows[0]!.applied
    })

  it('acts on an event once; a repeat delivery is ignored', async () => {
    const user = await t.createUser('Buyer')
    const orderId = await createOrder(user, 'pro')
    const paymentId = rzp('pay')
    expect(await apply('evt_once_1', 'payment.captured', orderId, paymentId)).toBe(true)
    expect(await apply('evt_once_1', 'payment.captured', orderId, paymentId)).toBe(false)
    // A different event about the same payment is recorded but changes nothing.
    expect(await apply('evt_once_2', 'order.paid', orderId, paymentId)).toBe(true)

    const periods = await t.asService((tx) =>
      tx.query('select id from plan_subscriptions where user_id = $1', [user]),
    )
    expect(periods.rows).toHaveLength(1)
  })

  it('agrees with the checkout callback: whichever comes first, one month is given', async () => {
    const user = await t.createUser('Buyer')
    const orderId = await createOrder(user, 'pro')
    const paymentId = rzp('pay')
    await confirm(orderId, paymentId)
    expect(await apply('evt_after_callback', 'payment.captured', orderId, paymentId)).toBe(true)
    const periods = await t.asService((tx) =>
      tx.query('select id from plan_subscriptions where user_id = $1', [user]),
    )
    expect(periods.rows).toHaveLength(1)
  })

  it("doesn't record an event whose confirmation failed, so a retry can succeed", async () => {
    const user = await t.createUser('Buyer')
    const orderId = await createOrder(user, 'pro', 19900)
    await rejects(apply('evt_bad_amount', 'payment.captured', orderId, rzp('pay'), 1))
    const seen = await t.asService((tx) =>
      tx.query("select 1 from payment_events where event_id = 'evt_bad_amount'"),
    )
    expect(seen.rows).toHaveLength(0)
  })

  it('records other event types without granting anything', async () => {
    const user = await t.createUser('Buyer')
    const orderId = await createOrder(user, 'pro')
    expect(await apply('evt_failed_1', 'payment.failed', orderId, rzp('pay'))).toBe(true)
    const periods = await t.asService((tx) =>
      tx.query('select id from plan_subscriptions where user_id = $1', [user]),
    )
    expect(periods.rows).toHaveLength(0)
  })
})
