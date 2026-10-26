import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { fakeApi, resetFakeApi } from './fake-api'
import { resetFakeSupabase } from './fake-supabase'

// findBy*/waitFor give up after 1 s by default, which is too tight when the whole
// suite runs in parallel on a busy machine; flaky timeouts hide real failures.
configure({ asyncUtilTimeout: 4000 })

// No test talks to a real Supabase project or API server.
vi.mock('@/lib/supabase', () => import('./fake-supabase'))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: fakeApi,
}))

beforeEach(() => {
  resetFakeSupabase()
  resetFakeApi()
})

afterEach(() => {
  cleanup()
})

// jsdom does not implement scrolling; ScrollRestoration calls it on navigation.
window.scrollTo = () => {}

// jsdom does not implement matchMedia; components that respect reduced motion read it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
