import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { ApiError, request } from './api'

function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API client', () => {
  it('sends the signed-in user’s access token', async () => {
    setSession(fakeSession())
    const fetchMock = mockFetch(json(200, { ok: true }))
    await request('/api/v1/me')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://api.test/api/v1/me')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer header.payload.signature',
    )
  })

  it('refuses to call an authenticated endpoint without a session', async () => {
    const fetchMock = mockFetch(json(200, {}))
    await expect(request('/api/v1/me')).rejects.toMatchObject({ status: 401, code: 'unauthorized' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not send a token to public endpoints', async () => {
    setSession(fakeSession())
    const fetchMock = mockFetch(json(201, { id: 'c1' }))
    await request('/api/v1/contact', { method: 'POST', body: {}, auth: false })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('turns error responses into ApiError with the server’s code, message and request ID', async () => {
    mockFetch(
      json(400, {
        error: {
          code: 'validation_failed',
          message: 'Some fields are invalid.',
          requestId: 'req-1',
        },
      }),
    )
    const error = await request('/x', { auth: false }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'validation_failed', requestId: 'req-1' })
  })

  it('reports network failures in plain language', async () => {
    mockFetch(new TypeError('Failed to fetch'))
    await expect(request('/x', { auth: false })).rejects.toMatchObject({
      code: 'network_error',
      message: expect.stringMatching(/could not reach everguide/i),
    })
  })

  it('returns undefined for 204 No Content', async () => {
    mockFetch(new Response(null, { status: 204 }))
    await expect(request('/x', { auth: false })).resolves.toBeUndefined()
  })
})
