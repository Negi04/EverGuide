import { rateLimit } from 'express-rate-limit'
import { AppError } from '../lib/errors.ts'

type LimitOptions = { windowMs: number; limit: number }

/**
 * Per-IP request limits. The in-memory store suits a single server instance; with
 * several instances, swap in a shared store (e.g. Redis) so limits apply across them.
 */
export function createRateLimiter({ windowMs, limit }: LimitOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(429, 'rate_limited', 'Too many requests. Please wait a little and try again.'))
    },
  })
}
