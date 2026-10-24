import type { AuthUser } from '../services/auth-service.ts'

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth after the access token has been verified. */
      auth?: { user: AuthUser; accessToken: string }
    }
  }
}

export {}
