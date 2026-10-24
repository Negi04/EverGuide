import type { AuthChangeEvent, Session } from '@supabase/auth-js'
import { vi } from 'vitest'

type Listener = (event: AuthChangeEvent, session: Session | null) => void

let currentSession: Session | null = null
const listeners = new Set<Listener>()

export function fakeSession(overrides: { id?: string; email?: string } = {}): Session {
  return {
    access_token: 'header.payload.signature',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: overrides.id ?? 'user-1', email: overrides.email ?? 'asha@example.com' },
  } as unknown as Session
}

/** Change the signed-in user and notify subscribers, like Supabase does. */
export function setSession(session: Session | null, event?: AuthChangeEvent) {
  currentSession = session
  listeners.forEach((listener) =>
    listener(event ?? (session ? 'SIGNED_IN' : 'SIGNED_OUT'), session),
  )
}

const ok = { data: {}, error: null }

export const fakeAuth = {
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}

export function resetFakeSupabase() {
  currentSession = null
  listeners.clear()
  fakeAuth.onAuthStateChange.mockImplementation((listener: Listener) => {
    listeners.add(listener)
    queueMicrotask(() => listener('INITIAL_SESSION', currentSession))
    return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }
  })
  fakeAuth.getSession.mockImplementation(async () => ({
    data: { session: currentSession },
    error: null,
  }))
  fakeAuth.signInWithPassword.mockResolvedValue(ok)
  fakeAuth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null })
  fakeAuth.signOut.mockImplementation(async () => {
    setSession(null)
    return { error: null }
  })
  fakeAuth.resend.mockResolvedValue(ok)
  fakeAuth.resetPasswordForEmail.mockResolvedValue(ok)
  fakeAuth.updateUser.mockResolvedValue(ok)
}

export const supabase = { auth: fakeAuth }
export let urlAuthError: string | null = null
export function setUrlAuthError(value: string | null) {
  urlAuthError = value
}
