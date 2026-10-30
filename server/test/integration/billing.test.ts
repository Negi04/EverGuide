/**
 * Demo billing against the real database. Razorpay itself is replaced by a stand-in
 * that uses the real signature code with a test secret, so no network call is made
 * and no Razorpay keys are needed.
 */
import { createHmac } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { pino } from 'pino'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.ts'
import { loadConfig } from '../../src/config/env.ts'
import { createDeps } from '../../src/deps.ts'
import { createPaymentGateway } from '../../src/lib/razorpay.ts'
import { createAdminClient, createUserClient } from '../../src/lib/supabase.ts'
import { createBillingService } from '../../src/services/billing-service.ts'

if (existsSync('../.env')) process.loadEnvFile('../.env')
const config = loadConfig({ ...process.env, NODE_ENV: 'test' })
const admin = createAdminClient(config)
const logger = pino({ level: 'silent' })
const keys = {
  keyId: 'rzp_test_Integration1',
  keySecret: 'integration-key-secret',
  webhookSecret: 'integration-webhook-secret',
}

const gateway = createPaymentGateway(keys)
let orders = 0
gateway.createOrder = async ({ amountPaise }) => ({
  id: `order_It${Date.now().toString(36)}${++orders}`,
  amount: amountPaise,
  currency: 'INR',
})
const billing = createBillingService(admin, (token) => createUserClient(config, token), gateway, {
  freeMonthlyAiLimit: config.ai.monthlyMessageLimit,
  logger,
})
const app = createApp({ ...createDeps(config, logger), billing })

const stamp = Date.now()
const userIds: string[] = []

async function signIn(label: string) {
  const email = `everguide-billing-${label}-${stamp}@example.com`
  const password = `Billing-${crypto.randomUUID()}`
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Billing ${label}` },
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

/** What Razorpay Checkout would hand the browser after paying. */
function paid(orderId: string, paymentId = `pay_It${Date.now().toString(36)}${++orders}`) {
  return {
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: createHmac('sha256', keys.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex'),
  }
}

let buyer: Awaited<ReturnType<typeof signIn>>
let stranger: Awaited<ReturnType<typeof signIn>>

beforeAll(async () => {
  buyer = await signIn('buyer')
  stranger = await signIn('stranger')
})

afterAll(async () => {
  // Orders, plan periods and test events go with the users (on delete cascade).
  await admin.from('payment_events').delete().like('event_id', `evt_it_${stamp}%`)
  for (const id of userIds) await admin.auth.admin.deleteUser(id)
})

describe('demo purchase', () => {
  it('starts on Free with the configured allowance', async () => {
    const res = await request(app).get('/api/v1/billing').set(buyer.headers)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      plan: 'free',
      aiMonthlyAllowance: config.ai.monthlyMessageLimit,
      demoMode: true,
      purchases: [],
    })
  })

  it('a verified payment gives a month of Pro and raises the AI allowance', async () => {
    const checkout = await request(app)
      .post('/api/v1/billing/checkout')
      .set(buyer.headers)
      .send({ plan: 'pro' })
    expect(checkout.status).toBe(201)
    expect(checkout.body).toMatchObject({ amountPaise: 19_900, keyId: keys.keyId })

    // Someone else can't confirm it, even with a correct signature.
    const confirmation = paid(checkout.body.razorpayOrderId)
    const hijack = await request(app)
      .post('/api/v1/billing/confirm')
      .set(stranger.headers)
      .send(confirmation)
    expect(hijack.status).toBe(404)

    const res = await request(app)
      .post('/api/v1/billing/confirm')
      .set(buyer.headers)
      .send(confirmation)
    expect(res.status).toBe(200)
    expect(res.body.plan).toBe('pro')
    expect(res.body.aiMonthlyAllowance).toBe(150)
    expect(res.body.purchases).toHaveLength(1)
    expect(await billing.monthlyAiLimit(buyer.id)).toBe(150)

    // Confirming again (a double click, a retry) changes nothing.
    const again = await request(app)
      .post('/api/v1/billing/confirm')
      .set(buyer.headers)
      .send(confirmation)
    expect(again.status).toBe(200)
    expect(again.body.purchases).toHaveLength(1)

    // The stranger sees none of it.
    const theirs = await request(app).get('/api/v1/billing').set(stranger.headers)
    expect(theirs.body).toMatchObject({ plan: 'free', purchases: [] })
  })

  it('refuses a forged signature', async () => {
    const checkout = await request(app)
      .post('/api/v1/billing/checkout')
      .set(buyer.headers)
      .send({ plan: 'premium' })
    const forged = { ...paid(checkout.body.razorpayOrderId), razorpaySignature: 'a'.repeat(64) }
    const res = await request(app).post('/api/v1/billing/confirm').set(buyer.headers).send(forged)
    expect(res.status).toBe(400)
    expect((await request(app).get('/api/v1/billing').set(buyer.headers)).body.plan).toBe('pro')
  })

  it('a webhook for a new order upgrades once, however often it is delivered', async () => {
    const checkout = await request(app)
      .post('/api/v1/billing/checkout')
      .set(buyer.headers)
      .send({ plan: 'premium' })
    const orderId: string = checkout.body.razorpayOrderId
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: `pay_Hook${stamp}`, order_id: orderId, amount: 49_900 } },
      },
    })
    const signature = createHmac('sha256', keys.webhookSecret).update(body).digest('hex')
    const deliver = () =>
      request(app)
        .post('/api/v1/billing/webhook')
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', signature)
        .set('X-Razorpay-Event-Id', `evt_it_${stamp}_1`)
        .send(body)

    expect((await deliver()).body).toEqual({ result: 'applied' })
    expect((await deliver()).body).toEqual({ result: 'duplicate' })

    const status = await request(app).get('/api/v1/billing').set(buyer.headers)
    expect(status.body.plan).toBe('premium')
    expect(status.body.aiMonthlyAllowance).toBe(400)
    expect(status.body.purchases).toHaveLength(2)
  })
})
