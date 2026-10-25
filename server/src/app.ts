import { randomUUID } from 'node:crypto'
import cors from 'cors'
import express from 'express'
import { HOUR, MINUTE } from 'express-rate-limit'
import helmet from 'helmet'
import type { Logger } from 'pino'
import { pinoHttp } from 'pino-http'
import type { Config } from './config/env.ts'
import { errorHandler, notFoundHandler } from './middleware/errors.ts'
import { createRateLimiter } from './middleware/rate-limit.ts'
import { registerAiRoutes } from './routes/ai.ts'
import { registerCareerRoutes } from './routes/career.ts'
import { contactRouter } from './routes/contact.ts'
import { healthRouter } from './routes/health.ts'
import { meRouter } from './routes/me.ts'
import type { AccountService } from './services/account-service.ts'
import type { AiGuideService } from './services/ai-guide-service.ts'
import type { AuthService } from './services/auth-service.ts'
import type { CareerService } from './services/career-service.ts'
import type { ContactService } from './services/contact-service.ts'
import type { ProfileService } from './services/profile-service.ts'

type LimitOptions = { windowMs: number; limit: number }

/** Everything the app needs from the outside world, injected so tests can use fakes. */
export type AppDeps = {
  config: Pick<Config, 'corsOrigins' | 'trustProxy'>
  logger: Logger
  auth: AuthService
  profiles: ProfileService
  accounts: AccountService
  contact: ContactService
  /** Null when no Gemini key is configured: AI endpoints then answer 503. */
  aiGuide: AiGuideService | null
  career: CareerService
  checkDatabase: () => Promise<boolean>
  /** Override individual limits (tests use small ones); the rest keep their defaults. */
  rateLimits?: Partial<Record<'api' | 'contact' | 'aiAnswers', LimitOptions>>
}

const defaultRateLimits = {
  api: { windowMs: 15 * MINUTE, limit: 300 },
  contact: { windowMs: HOUR, limit: 5 },
  // Per-IP burst protection; the monthly allowance per user is enforced separately.
  aiAnswers: { windowMs: MINUTE, limit: 10 },
}

// Accept a caller's request ID (e.g. from a load balancer) only if it looks safe to log.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/

export function createApp(deps: AppDeps) {
  const limits = { ...defaultRateLimits, ...deps.rateLimits }
  const allowedOrigins = new Set(deps.config.corsOrigins)
  const app = express()

  app.set('trust proxy', deps.config.trustProxy)

  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id']
        const id =
          typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID()
        res.setHeader('X-Request-Id', id)
        return id
      },
      customLogLevel: (_req, res, error) =>
        error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
      // Log what helps debugging, not every header: smaller logs, less risk of leaking data.
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  )
  app.use(helmet())
  app.use(
    cors({
      // Requests without an Origin header (curl, server-to-server) are not browser
      // cross-origin requests; CORS does not apply to them and auth still does.
      origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
      maxAge: 600,
    }),
  )
  app.use(express.json({ limit: '100kb' }))

  app.use('/health', healthRouter(deps.checkDatabase))

  const api = express.Router()
  api.use(createRateLimiter(limits.api))
  api.use('/contact', contactRouter(deps.contact, limits.contact))
  api.use('/me', meRouter(deps.auth, deps.profiles, deps.accounts))
  registerAiRoutes(api, deps.auth, deps.aiGuide, limits.aiAnswers)
  registerCareerRoutes(api, deps.auth, deps.career)
  app.use('/api/v1', api)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
