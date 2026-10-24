import { AuthClient } from '@supabase/auth-js'
import { env } from './env'

/**
 * Auth errors in email links (e.g. an expired confirmation link) arrive in the URL.
 * Read them before the client initialises, because it clears the URL afterwards.
 */
function readUrlAuthError(): string | null {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('error_description')
  return fromHash ?? new URLSearchParams(window.location.search).get('error_description')
}

export const urlAuthError = readUrlAuthError()

const projectRef = new URL(env.supabaseUrl).hostname.split('.')[0]

/**
 * The browser only needs Supabase Auth (app data goes through our API), so we use the
 * standalone auth client instead of the full supabase-js bundle. Configured the same way
 * supabase-js configures it: session in localStorage, refreshed automatically, and
 * tokens from email links (verification, password reset) picked up from the URL.
 */
export const supabase = {
  auth: new AuthClient({
    url: `${env.supabaseUrl}/auth/v1`,
    headers: { Authorization: `Bearer ${env.supabaseAnonKey}`, apikey: env.supabaseAnonKey },
    storageKey: `sb-${projectRef}-auth-token`,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }),
}
