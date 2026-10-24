import type { Session, User } from '@supabase/auth-js'
import { createContext } from 'react'

export type AuthState = {
  status: 'loading' | 'signed-in' | 'signed-out'
  session: Session | null
  user: User | null
}

export type AuthContextValue = AuthState & {
  signOut: (scope?: 'local' | 'global') => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
