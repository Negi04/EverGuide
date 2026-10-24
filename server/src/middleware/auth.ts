import type { AppRole } from '@everguide/shared'
import type { Request, RequestHandler } from 'express'
import { forbidden, unauthorized } from '../lib/errors.ts'
import type { AuthService } from '../services/auth-service.ts'
import type { UserContext } from '../services/profile-service.ts'

// A JWT is three base64url segments separated by dots. The scheme name is
// case-insensitive in HTTP, so "bearer" is accepted too.
const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i

/** Rejects the request with 401 unless it carries a valid Supabase access token. */
export function requireAuth(auth: AuthService): RequestHandler {
  return async (req, _res, next) => {
    const match = BEARER.exec(req.get('authorization') ?? '')
    const token = match?.[1]
    if (!token) throw unauthorized()

    const user = await auth.verifyAccessToken(token)
    if (!user) throw unauthorized('Your session has expired. Please sign in again.')

    req.auth = { user, accessToken: token }
    next()
  }
}

/** Rejects with 403 unless the signed-in user holds the role, checked in the database. */
export function requireRole(auth: AuthService, role: AppRole): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) throw unauthorized()
    const roles = await auth.getRoles(req.auth.user.id)
    if (!roles.includes(role)) throw forbidden()
    next()
  }
}

/** The verified user for a route behind requireAuth. */
export function userContext(req: Request): UserContext {
  if (!req.auth) throw unauthorized()
  return { userId: req.auth.user.id, email: req.auth.user.email, accessToken: req.auth.accessToken }
}
