import type {
  ApiErrorBody,
  ApiErrorCode,
  ContactMessage,
  Me,
  OnboardingInput,
  ProfileUpdate,
} from '@everguide/shared'
import { env } from './env'
import { supabase } from './supabase'

type ErrorDetails = ApiErrorBody['error']['details']

/** Error thrown for any failed API call, carrying the server's stable error code. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | 'network_error'
  readonly details?: ErrorDetails
  readonly requestId?: string

  constructor(
    status: number,
    code: ApiErrorCode | 'network_error',
    message: string,
    details?: ErrorDetails,
    requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
}

const TIMEOUT_MS = 15_000

export async function request<T>(
  path: string,
  { method = 'GET', body, auth = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new ApiError(401, 'unauthorized', 'Please sign in to continue.')
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw new ApiError(
      0,
      'network_error',
      timedOut
        ? 'EverGuide took too long to respond. Please try again.'
        : 'We could not reach EverGuide. Check your connection and try again.',
    )
  }

  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = (data as Partial<ApiErrorBody> | null)?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'internal_error',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.details,
      error?.requestId,
    )
  }
  return data as T
}

export const api = {
  getMe: () => request<Me>('/api/v1/me'),
  updateProfile: (input: ProfileUpdate) =>
    request<Me>('/api/v1/me/profile', { method: 'PATCH', body: input }),
  saveOnboarding: (input: OnboardingInput) =>
    request<Me>('/api/v1/me/onboarding', { method: 'PUT', body: input }),
  deleteAccount: () =>
    request<void>('/api/v1/me', { method: 'DELETE', body: { confirm: 'DELETE' } }),
  submitContact: (input: ContactMessage) =>
    request<{ id: string }>('/api/v1/contact', { method: 'POST', body: input, auth: false }),
}
