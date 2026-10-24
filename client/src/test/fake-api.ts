import type {
  ChatMessage,
  ChatStreamEvent,
  ConversationDetail,
  ConversationSummary,
  Me,
} from '@everguide/shared'
import { vi } from 'vitest'

export function fakeMe(overrides: Partial<Me> = {}): Me {
  return {
    id: 'user-1',
    email: 'asha@example.com',
    fullName: 'Asha Rao',
    avatarUrl: null,
    timezone: 'Asia/Kolkata',
    roles: ['user'],
    preferences: {
      lifeStage: 'college_student',
      primaryGoals: ['find_first_job'],
      targetCareer: 'Data analyst',
      preferredDomains: ['career'],
      skillLevel: 'beginner',
    },
    onboardingCompletedAt: '2026-10-24T00:00:00.000Z',
    ...overrides,
  }
}

export const conversationId = '0b6c8f2e-2f3a-4c1d-9f50-1d2e3f4a5b6c'

export function fakeConversation(overrides: Partial<ConversationDetail> = {}): ConversationDetail {
  return {
    id: conversationId,
    title: 'New conversation',
    domain: 'career',
    lastMessageAt: new Date().toISOString(),
    messages: [],
    ...overrides,
  }
}

export function fakeAnswer(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'answer-1',
    role: 'assistant',
    content: 'Track your spending for a month first [1].',
    createdAt: new Date().toISOString(),
    grounded: true,
    safetyFlag: null,
    citations: [
      {
        number: 1,
        title: 'Budgeting basics',
        sourceName: 'EverGuide starter guide (AI-drafted, pending expert review)',
        sourceUrl: null,
        excerpt: 'For one month, record all income and spending.',
        similarity: 0.72,
      },
    ],
    feedback: null,
    ...overrides,
  }
}

type StreamOptions = { signal: AbortSignal; onEvent: (event: ChatStreamEvent) => void }

/** Default stream: a grounded answer with one citation. */
export async function defaultStream(_id: string, question: string, { onEvent }: StreamOptions) {
  const conversation: ConversationSummary = { ...fakeConversation(), title: question }
  onEvent({
    type: 'start',
    conversation,
    userMessage: {
      ...fakeAnswer(),
      id: 'question-1',
      role: 'user',
      content: question,
      grounded: null,
      citations: [],
    },
  })
  onEvent({ type: 'delta', text: 'Track your spending ' })
  onEvent({ type: 'delta', text: 'for a month first [1].' })
  onEvent({
    type: 'done',
    message: fakeAnswer(),
    usage: { used: 1, limit: 30, periodEnd: '2026-11-01T00:00:00.000Z' },
  })
  onEvent({ type: 'followups', questions: ['How do I save for emergencies?'] })
}

export const fakeApi = {
  getMe: vi.fn(),
  updateProfile: vi.fn(),
  saveOnboarding: vi.fn(),
  deleteAccount: vi.fn(),
  submitContact: vi.fn(),
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  getConversation: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  sendFeedback: vi.fn(),
  getUsage: vi.fn(),
  streamMessage: vi.fn(),
}

export function resetFakeApi() {
  fakeApi.getMe.mockResolvedValue(fakeMe())
  fakeApi.updateProfile.mockImplementation(async (input) => ({ ...fakeMe(), ...input }))
  fakeApi.saveOnboarding.mockImplementation(async (input) => ({
    ...fakeMe(),
    preferences: { ...input, targetCareer: input.targetCareer || null },
  }))
  fakeApi.deleteAccount.mockResolvedValue(undefined)
  fakeApi.submitContact.mockResolvedValue({ id: 'contact-1' })
  fakeApi.listConversations.mockResolvedValue([])
  fakeApi.createConversation.mockImplementation(async (domain) => fakeConversation({ domain }))
  fakeApi.getConversation.mockResolvedValue(fakeConversation())
  fakeApi.updateConversation.mockImplementation(async (_id, patch) => ({
    ...fakeConversation(),
    ...patch,
  }))
  fakeApi.deleteConversation.mockResolvedValue(undefined)
  fakeApi.sendFeedback.mockResolvedValue(undefined)
  fakeApi.getUsage.mockResolvedValue({ used: 0, limit: 30, periodEnd: '2026-11-01T00:00:00.000Z' })
  fakeApi.streamMessage.mockImplementation(defaultStream)
}
