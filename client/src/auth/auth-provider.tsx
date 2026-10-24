import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthState } from './auth-context'

/** Tracks the Supabase session and exposes it to the app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null, user: null })

  useEffect(() => {
    // Fires immediately with the stored session (INITIAL_SESSION), then on every change.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({
        status: session ? 'signed-in' : 'signed-out',
        session,
        user: session?.user ?? null,
      })
      // Never let one user's cached data be shown to the next person on this device.
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const signOut = useCallback(async (scope: 'local' | 'global' = 'local') => {
    await supabase.auth.signOut({ scope })
  }, [])

  const value = useMemo(() => ({ ...state, signOut }), [state, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
