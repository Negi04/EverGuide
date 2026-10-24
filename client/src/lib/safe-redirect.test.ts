import { describe, expect, it } from 'vitest'
import { safeRedirect } from './safe-redirect'

describe('safeRedirect', () => {
  it.each([['/app'], ['/app/settings?tab=profile'], ['/onboarding']])(
    'allows the in-site path %s',
    (path) => {
      expect(safeRedirect(path)).toBe(path)
    },
  )

  it.each([
    ['https://evil.example/login'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    [''],
    [null],
  ])('falls back for the unsafe value %s', (value) => {
    expect(safeRedirect(value)).toBe('/app')
  })
})
