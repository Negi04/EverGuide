import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPaymentGateway, hmacHex, signaturesMatch } from '../src/lib/razorpay.ts'

const config = {
  keyId: 'rzp_test_AbCdEf123456',
  keySecret: 'test-key-secret',
  webhookSecret: 'test-webhook-secret',
}

afterEach(() => vi.unstubAllGlobals())

describe('hmacHex', () => {
  it('matches the published HMAC-SHA256 test vector (RFC 4231 case 2)', () => {
    expect(hmacHex('what do ya want for nothing?', 'Jefe')).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    )
  })
})

describe('signaturesMatch', () => {
  it('accepts only the exact signature', () => {
    const good = hmacHex('a|b', 'secret')
    expect(signaturesMatch(good, good)).toBe(true)
    expect(
      signaturesMatch(
        good,
        good.replace(/.$/, (c) => (c === '0' ? '1' : '0')),
      ),
    ).toBe(false)
    expect(signaturesMatch(good, good.slice(0, -1))).toBe(false)
    expect(signaturesMatch(good, '')).toBe(false)
    expect(signaturesMatch(good, undefined)).toBe(false)
  })
})

describe('checkout signature', () => {
  const gateway = createPaymentGateway(config)
  // Razorpay's documented scheme: HMAC-SHA256 of "order_id|payment_id" with the key secret.
  const sign = (orderId: string, paymentId: string, secret = config.keySecret) =>
    createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')

  it('accepts a payment signed for this order', () => {
    expect(gateway.verifyCheckout('order_A1', 'pay_B2', sign('order_A1', 'pay_B2'))).toBe(true)
  })

  it('refuses a signature for a different order, payment or secret', () => {
    const signature = sign('order_A1', 'pay_B2')
    expect(gateway.verifyCheckout('order_OTHER', 'pay_B2', signature)).toBe(false)
    expect(gateway.verifyCheckout('order_A1', 'pay_OTHER', signature)).toBe(false)
    expect(
      gateway.verifyCheckout('order_A1', 'pay_B2', sign('order_A1', 'pay_B2', 'wrong-secret')),
    ).toBe(false)
  })
})

describe('webhook signature', () => {
  const body = Buffer.from('{"event":"payment.captured","payload":{}}')
  const signature = createHmac('sha256', config.webhookSecret).update(body).digest('hex')

  it('accepts the exact bytes that were signed', () => {
    expect(createPaymentGateway(config).verifyWebhook(body, signature)).toBe(true)
  })

  it('refuses a body changed by even one byte, such as re-serialised JSON', () => {
    const reformatted = Buffer.from('{"event": "payment.captured","payload":{}}')
    expect(createPaymentGateway(config).verifyWebhook(reformatted, signature)).toBe(false)
  })

  it('refuses everything when no webhook secret is configured', () => {
    const gateway = createPaymentGateway({ ...config, webhookSecret: null })
    expect(gateway.webhooksEnabled).toBe(false)
    expect(gateway.verifyWebhook(body, signature)).toBe(false)
  })
})

describe('createOrder', () => {
  it('creates an INR order with the key id and secret as basic auth', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body)) as { amount: number }
      return Response.json({ id: 'order_Xyz123', amount: sent.amount, currency: 'INR' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const order = await createPaymentGateway(config).createOrder({
      amountPaise: 19_900,
      receipt: 'eg_1',
      notes: { plan: 'pro' },
    })
    expect(order.id).toBe('order_Xyz123')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.razorpay.com/v1/orders')
    const auth = new Headers(init.headers).get('Authorization')!
    expect(Buffer.from(auth.replace('Basic ', ''), 'base64').toString()).toBe(
      `${config.keyId}:${config.keySecret}`,
    )
    expect(JSON.parse(String(init.body))).toEqual({
      amount: 19_900,
      currency: 'INR',
      receipt: 'eg_1',
      notes: { plan: 'pro' },
    })
  })

  it('refuses an order whose amount differs from what was asked', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json({ id: 'order_Xyz123', amount: 1, currency: 'INR' }),
    )
    await expect(
      createPaymentGateway(config).createOrder({ amountPaise: 19_900, receipt: 'r', notes: {} }),
    ).rejects.toThrow(/unexpected order/)
  })

  it('reports an error status without the response body', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"error":"bad key"}', { status: 401 }))
    await expect(
      createPaymentGateway(config).createOrder({ amountPaise: 19_900, receipt: 'r', notes: {} }),
    ).rejects.toThrow('Razorpay returned 401')
  })
})
