import { contactMessageSchema } from '@everguide/shared'
import { Router } from 'express'
import { parse } from '../lib/validation.ts'
import { createRateLimiter } from '../middleware/rate-limit.ts'
import type { ContactService } from '../services/contact-service.ts'

export function contactRouter(contact: ContactService, limit: { windowMs: number; limit: number }): Router {
  const router = Router()

  // Public endpoint, so it gets a much tighter limit than the rest of the API.
  router.post('/', createRateLimiter(limit), async (req, res) => {
    const message = parse(contactMessageSchema, req.body)
    const { id } = await contact.submit(message)
    res.status(201).json({ id })
  })

  return router
}
