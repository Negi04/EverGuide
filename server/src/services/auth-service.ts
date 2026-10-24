import type { AppRole } from '@everguide/shared'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { serviceUnavailable } from '../lib/errors.ts'
import type { Db } from '../lib/supabase.ts'

export type AuthUser = { id: string; email: string | null }

export interface AuthService {
  /** Returns the user for a valid access token, or null if the token is invalid or expired. */
  verifyAccessToken(token: string): Promise<AuthUser | null>
  /** Roles come from the database on every check — never from the client or the token. */
  getRoles(userId: string): Promise<AppRole[]>
}

export function createAuthService(admin: Db): AuthService {
  return {
    async verifyAccessToken(token) {
      // getClaims verifies the signature and expiry (locally when the project uses
      // asymmetric signing keys, otherwise by asking Supabase Auth).
      const { data, error } = await admin.auth.getClaims(token)
      if (error) {
        if (isAuthRetryableFetchError(error)) throw serviceUnavailable()
        return null
      }
      const claims = data?.claims
      // A valid project key (e.g. the legacy anon JWT) is not a signed-in user.
      if (!claims || claims.role !== 'authenticated' || typeof claims.sub !== 'string') return null
      return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null }
    },

    async getRoles(userId) {
      const { data, error } = await admin.from('user_roles').select('role').eq('user_id', userId)
      if (error) throw serviceUnavailable()
      return data.map((row) => row.role)
    },
  }
}
