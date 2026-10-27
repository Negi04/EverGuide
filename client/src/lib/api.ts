import type {
  AdminResource,
  Resource,
  ResourceCreate,
  ResourcePage,
  ResourceQuery,
  ResourceUpdate,
  UploadTicket,
  Budget,
  BudgetItemCreate,
  BudgetItemUpdate,
  SavingsEntryInput,
  SavingsGoal,
  SavingsGoalCreate,
  SavingsGoalUpdate,
  Habit,
  HabitCreate,
  HabitList,
  HabitUpdate,
  JournalEntry,
  JournalEntryCreate,
  JournalEntryUpdate,
  JournalPage,
  AiUsage,
  AppNotification,
  AvailabilityWindow,
  Booking,
  BookingResponse,
  ApiErrorBody,
  ApiErrorCode,
  ChatStreamEvent,
  ContactMessage,
  ConversationDetail,
  ConversationSummary,
  ConversationUpdate,
  Feedback,
  Goal,
  GoalCreate,
  GoalUpdate,
  GuidanceDomain,
  InterviewCategory,
  InterviewQuestionDetail,
  InterviewQuestionList,
  InterviewRole,
  Me,
  MentorApplication,
  MentorApplicationForReview,
  MentorCard,
  MentorDetail,
  MentorExpertise,
  MentorProfileUpdate,
  MentorReviewInput,
  MyMentorProfile,
  MilestoneCreate,
  MilestoneUpdate,
  OnboardingInput,
  PracticeAttempt,
  PracticeAttemptInput,
  ProfileUpdate,
  Recommendation,
  ResumeAnalysis,
  ResumeAnalysisRequest,
  ResumeDetail,
  ResumeSummary,
  Slot,
  VerificationDecision,
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

/** Upload a PDF as the raw request body (not JSON), with the original name in a header. */
async function uploadResume(file: File): Promise<ResumeSummary> {
  let response: Response
  try {
    response = await fetch(`${env.apiUrl}/api/v1/resumes`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/pdf',
        'X-File-Name': encodeURIComponent(file.name),
        Authorization: await bearerToken(),
      },
      body: file,
      signal: AbortSignal.timeout(60_000),
    })
  } catch (error) {
    throw networkError(error)
  }
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as ResumeSummary
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
  listGoals: () => request<Goal[]>('/api/v1/goals'),
  createGoal: (input: GoalCreate) =>
    request<Goal>('/api/v1/goals', { method: 'POST', body: input }),
  updateGoal: (id: string, patch: GoalUpdate) =>
    request<Goal>(`/api/v1/goals/${id}`, { method: 'PATCH', body: patch }),
  deleteGoal: (id: string) => request<void>(`/api/v1/goals/${id}`, { method: 'DELETE' }),
  goalRecommendations: (id: string) =>
    request<Recommendation[]>(`/api/v1/goals/${id}/recommendations`),
  addMilestone: (goalId: string, input: MilestoneCreate) =>
    request<Goal>(`/api/v1/goals/${goalId}/milestones`, { method: 'POST', body: input }),
  updateMilestone: (id: string, patch: MilestoneUpdate) =>
    request<Goal>(`/api/v1/milestones/${id}`, { method: 'PATCH', body: patch }),
  deleteMilestone: (id: string) => request<Goal>(`/api/v1/milestones/${id}`, { method: 'DELETE' }),
  listInterviewQuestions: (filters: {
    role?: InterviewRole
    category?: InterviewCategory
    saved?: boolean
  }) => {
    const params = new URLSearchParams()
    if (filters.role) params.set('role', filters.role)
    if (filters.category) params.set('category', filters.category)
    if (filters.saved) params.set('saved', 'true')
    const query = params.toString()
    return request<InterviewQuestionList>(`/api/v1/interview/questions${query ? `?${query}` : ''}`)
  },
  getInterviewQuestion: (id: string) =>
    request<InterviewQuestionDetail>(`/api/v1/interview/questions/${id}`),
  setQuestionSaved: (id: string, saved: boolean) =>
    request<void>(`/api/v1/interview/questions/${id}/saved`, { method: 'PUT', body: { saved } }),
  createPracticeAttempt: (id: string, input: PracticeAttemptInput) =>
    request<PracticeAttempt>(`/api/v1/interview/questions/${id}/attempts`, {
      method: 'POST',
      body: input,
    }),
  deletePracticeAttempt: (id: string) =>
    request<void>(`/api/v1/interview/attempts/${id}`, { method: 'DELETE' }),
  listResumes: () => request<ResumeSummary[]>('/api/v1/resumes'),
  getResume: (id: string) => request<ResumeDetail>(`/api/v1/resumes/${id}`),
  uploadResume,
  deleteResume: (id: string) => request<void>(`/api/v1/resumes/${id}`, { method: 'DELETE' }),
  analyseResume: (id: string, input: ResumeAnalysisRequest) =>
    request<ResumeAnalysis>(`/api/v1/resumes/${id}/analyses`, { method: 'POST', body: input }),
  listMentors: (filters: { expertise?: MentorExpertise; q?: string; language?: string }) => {
    const params = new URLSearchParams()
    if (filters.expertise) params.set('expertise', filters.expertise)
    if (filters.q) params.set('q', filters.q)
    if (filters.language) params.set('language', filters.language)
    const query = params.toString()
    return request<MentorCard[]>(`/api/v1/mentors${query ? `?${query}` : ''}`, { auth: false })
  },
  getMentor: (id: string) => request<MentorDetail>(`/api/v1/mentors/${id}`, { auth: false }),
  mentorSlots: (id: string, days = 14) =>
    request<Slot[]>(`/api/v1/mentors/${id}/slots?days=${days}`, { auth: false }),
  getMyMentorProfile: () => request<MyMentorProfile | null>('/api/v1/me/mentor-profile'),
  applyAsMentor: (input: MentorApplication) =>
    request<MyMentorProfile>('/api/v1/me/mentor-profile', { method: 'POST', body: input }),
  updateMyMentorProfile: (patch: MentorProfileUpdate) =>
    request<MyMentorProfile>('/api/v1/me/mentor-profile', { method: 'PATCH', body: patch }),
  saveAvailability: (windows: AvailabilityWindow[]) =>
    request<MyMentorProfile>('/api/v1/me/mentor-profile/availability', {
      method: 'PUT',
      body: { windows },
    }),
  listBookings: () => request<Booking[]>('/api/v1/bookings'),
  requestBooking: (input: { mentorId: string; startsAt: string; topic: string }) =>
    request<{ id: string }>('/api/v1/bookings', { method: 'POST', body: input }),
  respondToBooking: (id: string, input: BookingResponse) =>
    request<void>(`/api/v1/bookings/${id}/respond`, { method: 'POST', body: input }),
  cancelBooking: (id: string, reason?: string) =>
    request<void>(`/api/v1/bookings/${id}/cancel`, { method: 'POST', body: { reason } }),
  rescheduleBooking: (id: string, startsAt: string) =>
    request<void>(`/api/v1/bookings/${id}/reschedule`, { method: 'POST', body: { startsAt } }),
  reviewBooking: (id: string, input: MentorReviewInput) =>
    request<void>(`/api/v1/bookings/${id}/review`, { method: 'POST', body: input }),
  listMentorApplications: () =>
    request<MentorApplicationForReview[]>('/api/v1/admin/mentor-applications'),
  decideMentorApplication: (id: string, input: VerificationDecision) =>
    request<void>(`/api/v1/admin/mentor-applications/${id}/decision`, {
      method: 'POST',
      body: input,
    }),
  listNotifications: () => request<AppNotification[]>('/api/v1/notifications'),
  markNotificationsRead: (ids?: string[]) =>
    request<void>('/api/v1/notifications/read', { method: 'POST', body: { ids } }),

  listJournal: (query: { q?: string; offset?: number } = {}) => {
    const params = new URLSearchParams()
    if (query.q) params.set('q', query.q)
    if (query.offset) params.set('offset', String(query.offset))
    const qs = params.toString()
    return request<JournalPage>(`/api/v1/journal${qs ? `?${qs}` : ''}`)
  },
  createJournalEntry: (input: JournalEntryCreate) =>
    request<JournalEntry>('/api/v1/journal', { method: 'POST', body: input }),
  updateJournalEntry: (id: string, patch: JournalEntryUpdate) =>
    request<JournalEntry>(`/api/v1/journal/${id}`, { method: 'PATCH', body: patch }),
  deleteJournalEntry: (id: string) => request<void>(`/api/v1/journal/${id}`, { method: 'DELETE' }),
  listHabits: () => request<HabitList>('/api/v1/habits'),
  createHabit: (input: HabitCreate) =>
    request<Habit>('/api/v1/habits', { method: 'POST', body: input }),
  updateHabit: (id: string, patch: HabitUpdate) =>
    request<Habit>(`/api/v1/habits/${id}`, { method: 'PATCH', body: patch }),
  deleteHabit: (id: string) => request<void>(`/api/v1/habits/${id}`, { method: 'DELETE' }),
  setHabitCheckin: (id: string, date: string, done: boolean) =>
    request<Habit>(`/api/v1/habits/${id}/checkins/${date}`, { method: done ? 'PUT' : 'DELETE' }),

  getBudget: (month: string) => request<Budget>(`/api/v1/budgets/${month}`),
  setBudgetIncome: (month: string, incomePaise: number) =>
    request<Budget>(`/api/v1/budgets/${month}`, { method: 'PUT', body: { incomePaise } }),
  addBudgetItem: (month: string, input: BudgetItemCreate) =>
    request<Budget>(`/api/v1/budgets/${month}/items`, { method: 'POST', body: input }),
  copyPreviousBudget: (month: string) =>
    request<Budget>(`/api/v1/budgets/${month}/copy-previous`, { method: 'POST' }),
  updateBudgetItem: (id: string, patch: BudgetItemUpdate) =>
    request<Budget>(`/api/v1/budget-items/${id}`, { method: 'PATCH', body: patch }),
  deleteBudgetItem: (id: string) =>
    request<Budget>(`/api/v1/budget-items/${id}`, { method: 'DELETE' }),
  listSavingsGoals: () => request<SavingsGoal[]>('/api/v1/savings-goals'),
  createSavingsGoal: (input: SavingsGoalCreate) =>
    request<SavingsGoal>('/api/v1/savings-goals', { method: 'POST', body: input }),
  updateSavingsGoal: (id: string, patch: SavingsGoalUpdate) =>
    request<SavingsGoal>(`/api/v1/savings-goals/${id}`, { method: 'PATCH', body: patch }),
  deleteSavingsGoal: (id: string) =>
    request<void>(`/api/v1/savings-goals/${id}`, { method: 'DELETE' }),
  addSavingsEntry: (goalId: string, input: SavingsEntryInput) =>
    request<SavingsGoal>(`/api/v1/savings-goals/${goalId}/entries`, {
      method: 'POST',
      body: input,
    }),
  deleteSavingsEntry: (id: string) =>
    request<SavingsGoal>(`/api/v1/savings-entries/${id}`, { method: 'DELETE' }),

  listResources: (filters: ResourceQuery = {}) => {
    const params = new URLSearchParams()
    for (const key of ['q', 'domain', 'kind', 'level'] as const) {
      const value = filters[key]
      if (value) params.set(key, value)
    }
    if (filters.offset) params.set('offset', String(filters.offset))
    const query = params.toString()
    return request<ResourcePage>(`/api/v1/resources${query ? `?${query}` : ''}`, { auth: false })
  },
  getResource: (slug: string) => request<Resource>(`/api/v1/resources/${slug}`, { auth: false }),
  listSavedResources: () => request<Resource[]>('/api/v1/me/saved-resources'),
  setResourceSaved: (id: string, saved: boolean) =>
    request<{ saved: boolean }>(`/api/v1/resources/${id}/save`, {
      method: saved ? 'PUT' : 'DELETE',
    }),
  adminListResources: () => request<AdminResource[]>('/api/v1/admin/resources'),
  adminCreateResource: (input: ResourceCreate) =>
    request<AdminResource>('/api/v1/admin/resources', { method: 'POST', body: input }),
  adminUpdateResource: (id: string, patch: ResourceUpdate) =>
    request<AdminResource>(`/api/v1/admin/resources/${id}`, { method: 'PATCH', body: patch }),
  adminDeleteResource: (id: string) =>
    request<void>(`/api/v1/admin/resources/${id}`, { method: 'DELETE' }),

  /**
   * Upload a cover image: our server signs a one-time ticket, then the browser sends the
   * file straight to Cloudinary (never through our server, and without our login token).
   */
  uploadResourceImage: async (file: File): Promise<{ publicId: string; previewUrl: string }> => {
    const ticket = await request<UploadTicket>('/api/v1/admin/uploads/resource-image', {
      method: 'POST',
    })
    const form = new FormData()
    for (const [key, value] of Object.entries(ticket.fields)) form.set(key, value)
    form.set('file', file)
    let response: Response
    try {
      response = await fetch(ticket.uploadUrl, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(60_000),
      })
    } catch {
      throw new Error('The upload didn’t finish. Check your connection and try again.')
    }
    const body = (await response.json().catch(() => ({}))) as {
      public_id?: string
      secure_url?: string
      error?: { message?: string }
    }
    if (!response.ok || !body.public_id || !body.secure_url) {
      throw new Error(body.error?.message ?? 'The image upload was refused. Please try again.')
    }
    return { publicId: body.public_id, previewUrl: body.secure_url }
  },
}
