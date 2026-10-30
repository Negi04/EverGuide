import { z } from 'zod'
import { paidPlanIds, type PaidPlanId, type PlanId } from './plans.ts'

// ---------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------

export const checkoutRequestSchema = z.strictObject({
  plan: z.enum(paidPlanIds, { error: 'Choose Pro or Premium.' }),
})
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>

/** What Razorpay Checkout hands the browser after a successful payment. */
export const paymentConfirmationSchema = z.strictObject({
  razorpayOrderId: z.string().regex(/^order_[A-Za-z0-9]{1,40}$/, 'Invalid order id.'),
  razorpayPaymentId: z.string().regex(/^pay_[A-Za-z0-9]{1,40}$/, 'Invalid payment id.'),
  razorpaySignature: z.string().regex(/^[0-9a-f]{64}$/, 'Invalid signature.'),
})
export type PaymentConfirmation = z.infer<typeof paymentConfirmationSchema>

// ---------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------

/** Everything the browser needs to open Razorpay Checkout for one order. */
export type CheckoutOrder = {
  razorpayOrderId: string
  /** The public Test Mode key id (rzp_test_…). Never the secret. */
  keyId: string
  plan: PaidPlanId
  amountPaise: number
  currency: 'INR'
}

export type Purchase = {
  id: string
  plan: PaidPlanId
  amountPaise: number
  status: 'created' | 'paid'
  createdAt: string
  paidAt: string | null
  periodStart: string | null
  periodEnd: string | null
}

export type BillingStatus = {
  plan: PlanId
  /** When the current paid plan ends (null on Free). */
  currentPeriodEnd: string | null
  aiMonthlyAllowance: number
  /** False until the server has Razorpay Test Mode keys. */
  paymentsEnabled: boolean
  /** Always true here: no real money is charged. */
  demoMode: true
  purchases: Purchase[]
}
