import { describe, expect, it } from 'vitest'

// Source files of the app (not tests), loaded as text.
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('code conventions', () => {
  it('never passes an API function straight to mutationFn', () => {
    // TanStack Query v5 calls mutationFn(variables, context). Passing api.x directly
    // leaks the context object into the API call; wrap it: (input) => api.x(input).
    const offenders = Object.entries(sources)
      .filter(([, code]) => /mutationFn:\s*api\.\w+\s*[,}\n]/.test(code))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })

  it('found the source files to check', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50)
  })
})
