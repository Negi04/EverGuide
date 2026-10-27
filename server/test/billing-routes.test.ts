import { createHmac } from 'node:crypto'
import { PAID_PLANS, type BillingStatus } from '@everguide/shared'
import { pino } from 'pino'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createPaymentGateway } from '../src/lib/razorpay.ts'
import type { Db } from '../src/lib/supabase.ts'
import { createBillingService, type BillingService } from '../src/services/billing-service.ts'
import { buildTestApp, testUser, VALID_TOKEN } from './helpers.ts'

const auth = { Authorization: `Bearer ${VALID_TOKEN}` }
const logger = pino({ level: 'silent' })
const keys = {
  keyId: 'rzp_test_AbCdEf123456',
  keySecret: 'test-key-secret',
  webhookSecret: 'test-webhook-secret',
}
const signCheckout = (orderId: string, paymentId: string) =>
  createHmac('sha256', keys.keySecret).update(`${orderId}|${paymentId}`).digest('hex')
const signWebhook = (body: string) =>
  createHmac('sha256', keys.webhookSecret).update(body).digest('hex')

const freeStatus: BillingStatus = {
  plan: 'free',
  currentPeriodEnd: null,
  aiMonthlyAllowance: 30,
  paymentsEnabled: true,
  demoMode: true,
  purchases: [],
}

function fakeBilling(calls: unknown[] = []): BillingService {
  return {
    status: async () => freeStatus,
    createCheckout: async (_ctx, plan) => {
      calls.push({ plan })
      return {
        razorpayOrderId: 'order_A1',
        keyId: keys.keyId,
        plan,
        amountPaise: PAID_PLANS[plan].pricePaise,
        currency: 'INR',
      }
    },
    confirmCheckout: async (_ctx, input) => {
      calls.push(input)
      return freeStatus
    },
    handleWebhook: async (input) => {
      calls.push(input)
      return 'applied'
    },
    monthlyAiLimit: async () => 30,
  }
}

describe('billing routes', () => {
  it('require a signed-in user (except the webhook)', async () => {
    const { app } = buildTestApp({ billing: fakeBilling() })
    expect((await request(app).get('/api/v1/billing')).status).toBe(401)
    expect((await request(app).post('/api/v1/billing/checkout').send({ plan: 'pro' })).status).toBe(
      401,
    )
    expect((await request(app).post('/api/v1/billing/confirm').send({})).status).toBe(401)
  })

  it('only accepts a plan name: the browser can never set the price', async () => {
    const calls: unknown[] = []
    const { app } = buildTestApp({ billing: fakeBilling(calls) })
    const withPrice = await request(app)
      .post('/api/v1/billing/checkout')
      .set(auth)
      .send({ plan: 'pro', amountPaise: 100 })
    expect(withPrice.status).toBe(400)
    const unknown = await request(app)
      .post('/api/v1/billing/checkout')
      .set(auth)
      .send({ plan: 'enterprise' })
    expect(unknown.status).toBe(400)
    expect(calls).toEqual([])

    const ok = await request(app).post('/api/v1/billing/checkout').set(auth).send({ plan: 'pro' })
    expect(ok.status).toBe(201)
    expect(ok.body.amountPaise).toBe(19_900)
  })

  it('rejects malformed confirmation fields before checking anything', async () => {
    const calls: unknown[] = []
    const { app } = buildTestApp({ billing: fakeBilling(calls) })
    const res = await request(app).post('/api/v1/billing/confirm').set(auth).send({
      razorpayOrderId: 'order_A1',
      razorpayPaymentId: 'pay_B2',
      razorpaySignature: 'not-hex',
    })
    expect(res.status).toBe(400)
    expect(calls).toEqual([])
  })

  it('passes the webhook body through byte for byte, with its headers', async () => {
    const calls: { rawBody: Buffer; signature?: string; eventId?: string }[] = []
    const { app } = buildTestApp({ billing: fakeBilling(calls as unknown[]) })
    // Odd spacing on purpose: re-serialising the JSON would change the bytes and the signature.
    const body = '{ "event" :"payment.captured",  "payload":{} }'
    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', 'sig')
      .set('X-Razorpay-Event-Id', 'evt_1')
      .send(body)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ result: 'applied' })
    expect(calls[0]!.rawBody.toString()).toBe(body)
    expect(calls[0]!.signature).toBe('sig')
    expect(calls[0]!.eventId).toBe('evt_1')
  })
})

// ---------------------------------------------------------------------
// The service's own checks, with a tiny stand-in for the database
// ---------------------------------------------------------------------

type Recorded = { inserts: unknown[]; rpcs: { name: string; args: unknown }[] }

function fakeDb(
  order: { user_id: string } | null,
  rpc: (name: string) => { data: unknown; error: unknown } = () => ({ data: true, error: null }),
) {
  const recorded: Recorded = { inserts: [], rpcs: [] }
  const db = {
    from: () => ({
      insert: async (row: unknown) => {
        recorded.inserts.push(row)
        return { error: null }
      },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: order, error: null }) }) }),
    }),
    rpc: async (name: string, args: unknown) => {
      recorded.rpcs.push({ name, args })
      return rpc(name)
    },
  }
  return { db: db as unknown as Db, recorded }
}

const ctx = { userId: testUser.id, email: testUser.email, accessToken: VALID_TOKEN }

function service(db: Db, gatewayKeys = keys) {
  const gateway = createPaymentGateway(gatewayKeys)
  gateway.createOrder = async ({ amountPaise }) => ({
    id: 'order_Fake123',
    amount: amountPaise,
    currency: 'INR',
  })
  // status() reads through the user's client; these tests never call it.
  const noUserClient = () => {
    throw new Error('not used')
  }
  return createBillingService(db, noUserClient, gateway, { freeMonthlyAiLimit: 30, logger })
}

describe('billing service: checkout', () => {
  it('charges the server price and records the order', async () => {
    const { db, recorded } = fakeDb(null)
    const order = await service(db).createCheckout(ctx, 'premium')
    expect(order).toMatchObject({ amountPaise: 49_900, keyId: keys.keyId, currency: 'INR' })
    expect(recorded.inserts).toEqual([
      {
        user_id: testUser.id,
        plan: 'premium',
        amount_paise: 49_900,
        razorpay_order_id: 'order_Fake123',
      },
    ])
  })

  it('is switched off without keys', async () => {
    const { db } = fakeDb(null)
    const billing = createBillingService(db, () => db, null, { freeMonthlyAiLimit: 30, logger })
    await expect(billing.createCheckout(ctx, 'pro')).rejects.toMatchObject({ status: 503 })
  })

  const confirmation = {
    razorpayOrderId: 'order_Fake123',
    razorpayPaymentId: 'pay_Fake456',
    razorpaySignature: signCheckout('order_Fake123', 'pay_Fake456'),
  }

  it("won't confirm someone else's order, even with a valid signature", async () => {
    const { db, recorded } = fakeDb({ user_id: '22222222-2222-4222-8222-222222222222' })
    await expect(service(db).confirmCheckout(ctx, confirmation)).rejects.toMatchObject({
      status: 404,
    })
    expect(recorded.rpcs).toEqual([])
  })

  it("won't confirm a payment whose signature doesn't match", async () => {
    const { db, recorded } = fakeDb({ user_id: testUser.id })
    const forged = { ...confirmation, razorpayPaymentId: 'pay_Other999' }
    await expect(service(db).confirmCheckout(ctx, forged)).rejects.toMatchObject({ status: 400 })
    expect(recorded.rpcs).toEqual([])
  })

  it('turns a database refusal into a readable conflict', async () => {
    const { db } = fakeDb({ user_id: testUser.id }, () => ({
      data: null,
      error: { code: 'P0001', message: 'This order was already paid by another payment.' },
    }))
    await expect(service(db).confirmCheckout(ctx, confirmation)).rejects.toMatchObject({
      status: 409,
      message: 'This order was already paid by another payment.',
    })
  })
})

describe('billing service: webhook', () => {
  const event = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_W1', order_id: 'order_W1', amount: 19_900 } } },
  })
  const deliver = (billing: BillingService, body = event, signature = signWebhook(body)) =>
    billing.handleWebhook({ rawBody: Buffer.from(body), signature, eventId: 'evt_W1' })

  it('passes a signed event to the database once', async () => {
    const { db, recorded } = fakeDb(null)
    expect(await deliver(service(db))).toBe('applied')
    expect(recorded.rpcs).toEqual([
      {
        name: 'apply_payment_event',
        args: {
          p_event_id: 'evt_W1',
          p_event_type: 'payment.captured',
          p_razorpay_order_id: 'order_W1',
          p_razorpay_payment_id: 'pay_W1',
          p_amount_paise: 19_900,
        },
      },
    ])
  })

  it('reports a repeat delivery as a duplicate', async () => {
    const { db } = fakeDb(null, () => ({ data: false, error: null }))
    expect(await deliver(service(db))).toBe('duplicate')
  })

  it('rejects an unsigned or wrongly signed event without touching the database', async () => {
    const { db, recorded } = fakeDb(null)
    await expect(deliver(service(db), event, 'bad')).rejects.toMatchObject({ status: 401 })
    await expect(
      service(db).handleWebhook({
        rawBody: Buffer.from(event),
        signature: undefined,
        eventId: 'e',
      }),
    ).rejects.toMatchObject({ status: 401 })
    expect(recorded.rpcs).toEqual([])
  })

  it('needs an event id, since that is what makes repeats harmless', async () => {
    const { db } = fakeDb(null)
    await expect(
      service(db).handleWebhook({
        rawBody: Buffer.from(event),
        signature: signWebhook(event),
        eventId: undefined,
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('acknowledges events for orders it refuses, so Razorpay stops retrying', async () => {
    const { db } = fakeDb(null, () => ({
      data: null,
      error: { code: 'P0002', message: 'Order not found.' },
    }))
    expect(await deliver(service(db))).toBe('ignored')
  })

  it('answers 503 when no webhook secret is configured', async () => {
    const { db } = fakeDb(null)
    await expect(
      deliver(service(db, { ...keys, webhookSecret: null as unknown as string })),
    ).rejects.toMatchObject({ status: 503 })
  })
})
