import { checkoutRequestSchema, paymentConfirmationSchema } from '@everguide/shared'
import express, { type Express, type Router } from 'express'
import { parse } from '../lib/validation.ts'
import { requireAuth, userContext } from '../middleware/auth.ts'
import { createRateLimiter } from '../middleware/rate-limit.ts'
import type { AuthService } from '../services/auth-service.ts'
import type { BillingService } from '../services/billing-service.ts'

type LimitOptions = { windowMs: number; limit: number }

export const WEBHOOK_PATH = '/api/v1/billing/webhook'

/** Demo plan purchases for signed-in users. */
export function registerBillingRoutes(
  api: Router,
  auth: AuthService,
  billing: BillingService,
  checkoutLimit: LimitOptions,
) {
  const authed = requireAuth(auth)
  const checkoutLimiter = createRateLimiter(checkoutLimit)

  api.get('/billing', authed, async (req, res) => {
    res.json(await billing.status(userContext(req)))
  })

  api.post('/billing/checkout', checkoutLimiter, authed, async (req, res) => {
    const { plan } = parse(checkoutRequestSchema, req.body)
    res.status(201).json(await billing.createCheckout(userContext(req), plan))
  })

  api.post('/billing/confirm', checkoutLimiter, authed, async (req, res) => {
    const input = parse(paymentConfirmationSchema, req.body)
    res.json(await billing.confirmCheckout(userContext(req), input))
  })
}

/**
 * Razorpay's webhook. Registered on the app before the JSON parser: the signature
 * covers the exact bytes Razorpay sent, so the body must stay raw until checked.
 */
export function registerBillingWebhook(app: Express, billing: BillingService, limit: LimitOptions) {
  app.post(
    WEBHOOK_PATH,
    createRateLimiter(limit),
    express.raw({ type: 'application/json', limit: '100kb' }),
    async (req, res) => {
      const result = await billing.handleWebhook({
        rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
        signature: req.get('x-razorpay-signature'),
        eventId: req.get('x-razorpay-event-id'),
      })
      res.json({ result })
    },
  )
}
