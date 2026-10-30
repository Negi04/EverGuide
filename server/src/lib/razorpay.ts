import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Config } from '../config/env.ts'

const API = 'https://api.razorpay.com/v1'
const REQUEST_TIMEOUT_MS = 10_000

export type RazorpayOrder = { id: string; amount: number; currency: string }

export interface PaymentGateway {
  /** The public key id the browser needs for Checkout (rzp_test_…). */
  readonly keyId: string
  createOrder(input: {
    amountPaise: number
    receipt: string
    notes: Record<string, string>
  }): Promise<RazorpayOrder>
  /** True when Checkout's signature proves this payment belongs to this order. */
  verifyCheckout(orderId: string, paymentId: string, signature: string): boolean
  /** True when a webhook body was signed with our webhook secret. False without one. */
  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean
  readonly webhooksEnabled: boolean
}

/** HMAC-SHA256 of `message` as hex: the signature scheme Razorpay uses everywhere. */
export function hmacHex(message: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(message).digest('hex')
}

/**
 * Compare a received signature with the expected one in constant time, so the
 * response time doesn't reveal how many leading characters were right.
 */
export function signaturesMatch(expected: string, received: string | undefined): boolean {
  if (!received) return false
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(received, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function createPaymentGateway(config: NonNullable<Config['razorpay']>): PaymentGateway {
  const { keyId, keySecret, webhookSecret } = config
  const basicAuth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`

  return {
    keyId,
    webhooksEnabled: webhookSecret !== null,

    async createOrder({ amountPaise, receipt, notes }) {
      const response = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { Authorization: basicAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`Razorpay returned ${response.status}`)
      const order = (await response.json()) as RazorpayOrder
      // Never trust that the gateway echoed what we asked for.
      if (!/^order_[A-Za-z0-9]+$/.test(order.id) || order.amount !== amountPaise) {
        throw new Error('Razorpay returned an unexpected order')
      }
      return order
    },

    verifyCheckout(orderId, paymentId, signature) {
      return signaturesMatch(hmacHex(`${orderId}|${paymentId}`, keySecret), signature)
    },

    verifyWebhook(rawBody, signature) {
      if (!webhookSecret) return false
      return signaturesMatch(hmacHex(rawBody, webhookSecret), signature)
    },
  }
}
