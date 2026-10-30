import { createHmac } from 'node:crypto'
import { signaturesMatch } from './razorpay.ts'

/** Receivers reject events signed longer ago than this, so a captured request can't be replayed later. */
export const SIGNATURE_TOLERANCE_SECONDS = 300

/**
 * EverGuide's outbound event signature: HMAC-SHA256 over "<timestamp>.<body>",
 * sent as "v1=<hex>". Signing the timestamp too means an old request can't be
 * re-sent with a fresh time. The "v1=" prefix leaves room to change the scheme.
 */
export function signEvent(secret: string, timestamp: number, body: string): string {
  return `v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
}

/** The receiving side's check (n8n runs the same logic in its Code node). */
export function verifyEvent(
  secret: string,
  timestamp: string | undefined,
  body: string,
  signature: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const sent = Number(timestamp)
  if (!Number.isInteger(sent) || Math.abs(nowSeconds - sent) > SIGNATURE_TOLERANCE_SECONDS) {
    return false
  }
  return signaturesMatch(signEvent(secret, sent, body), signature)
}
