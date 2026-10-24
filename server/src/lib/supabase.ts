import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Config } from '../config/env.ts'
import type { Database } from '../db/database.types.ts'

export type Db = SupabaseClient<Database>

const REQUEST_TIMEOUT_MS = 10_000

/** Abort any call to Supabase that takes longer than the timeout. */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  return fetch(input, { ...init, signal })
}

// Servers must never store or refresh sessions; each request brings its own token.
const serverAuth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }

/**
 * Service-role client. Bypasses Row Level Security, so use it only for work the
 * server has already authorized (verifying tokens, reading roles, server-only tables).
 */
export function createAdminClient(config: Config): Db {
  return createClient<Database>(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: serverAuth,
    global: { fetch: fetchWithTimeout },
  })
}

/**
 * Client that acts as the signed-in user. Row Level Security still applies, so a bug
 * in our code cannot read or change another user's rows (defence in depth).
 */
export function createUserClient(config: Config, accessToken: string): Db {
  return createClient<Database>(config.supabase.url, config.supabase.anonKey, {
    auth: serverAuth,
    global: { fetch: fetchWithTimeout, headers: { Authorization: `Bearer ${accessToken}` } },
  })
}
