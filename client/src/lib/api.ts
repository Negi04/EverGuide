import type {
  AiUsage,
  ApiErrorBody,
  ApiErrorCode,
  ChatStreamEvent,
  ContactMessage,
  ConversationDetail,
  ConversationSummary,
  ConversationUpdate,
  Feedback,
  GuidanceDomain,
  Me,
  OnboardingInput,
  ProfileUpdate,
} from '@everguide/shared'
import { env } from './env'
import { readSse } from './sse'
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

async function bearerToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError(401, 'unauthorized', 'Please sign in to continue.')
  return `Bearer ${token}`
}

async function toApiError(response: Response): Promise<ApiError> {
  const data: unknown = await response.json().catch(() => null)
  const error = (data as Partial<ApiErrorBody> | null)?.error
  return new ApiError(
    response.status,
    error?.code ?? 'internal_error',
    error?.message ?? 'Something went wrong. Please try again.',
    error?.details,
    error?.requestId,
  )
}

function networkError(error: unknown): ApiError {
  const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
  return new ApiError(
    0,
    'network_error',
    timedOut
      ? 'EverGuide took too long to respond. Please try again.'
      : 'We could not reach EverGuide. Check your connection and try again.',
  )
}

export async function request<T>(
  path: string,
  { method = 'GET', body, auth = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) headers.Authorization = await bearerToken()

  let response: Response
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    throw networkError(error)
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/**
 * Ask a question and receive the answer as it is generated. Errors found before the
 * stream starts (validation, allowance) throw ApiError; problems while generating
 * arrive as an `error` event. Aborting the signal stops generation on the server too.
 */
export async function streamMessage(
  conversationId: string,
  content: string,
  { signal, onEvent }: { signal: AbortSignal; onEvent: (event: ChatStreamEvent) => void },
): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${env.apiUrl}/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        Authorization: await bearerToken(),
      },
      body: JSON.stringify({ content }),
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw networkError(error)
  }
  if (!response.ok) throw await toApiError(response)
  if (!response.body) {
    throw new ApiError(0, 'network_error', 'The answer could not be received. Please try again.')
  }

  for await (const message of readSse(response.body)) {
    onEvent(JSON.parse(message.data) as ChatStreamEvent)
  }
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
  listConversations: (search?: string) =>
    request<ConversationSummary[]>(
      `/api/v1/conversations${search ? `?q=${encodeURIComponent(search)}` : ''}`,
    ),
  createConversation: (domain: GuidanceDomain) =>
    request<ConversationSummary>('/api/v1/conversations', { method: 'POST', body: { domain } }),
  getConversation: (id: string) => request<ConversationDetail>(`/api/v1/conversations/${id}`),
  updateConversation: (id: string, patch: ConversationUpdate) =>
    request<ConversationSummary>(`/api/v1/conversations/${id}`, { method: 'PATCH', body: patch }),
  deleteConversation: (id: string) =>
    request<void>(`/api/v1/conversations/${id}`, { method: 'DELETE' }),
  sendFeedback: (messageId: string, feedback: Feedback) =>
    request<void>(`/api/v1/messages/${messageId}/feedback`, { method: 'PUT', body: feedback }),
  getUsage: () => request<AiUsage>('/api/v1/ai/usage'),
  streamMessage,
}
