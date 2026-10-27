import { useSyncExternalStore } from 'react'
import { getTheme, subscribeToTheme, type Theme } from '@/lib/theme'

/** The current theme; every toggle on the page stays in sync. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeToTheme, getTheme, () => 'dark')
}
