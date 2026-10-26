import type {
  ChatMessage,
  ChatStreamEvent,
  ConversationDetail,
  ConversationSummary,
  Goal,
  InterviewQuestion,
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
  listGoals: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  goalRecommendations: vi.fn(),
  addMilestone: vi.fn(),
  updateMilestone: vi.fn(),
  deleteMilestone: vi.fn(),
  listInterviewQuestions: vi.fn(),
  getInterviewQuestion: vi.fn(),
  setQuestionSaved: vi.fn(),
  createPracticeAttempt: vi.fn(),
  deletePracticeAttempt: vi.fn(),
  listResumes: vi.fn(),
  getResume: vi.fn(),
  uploadResume: vi.fn(),
  deleteResume: vi.fn(),
  analyseResume: vi.fn(),
  listMentors: vi.fn(),
  getMentor: vi.fn(),
  mentorSlots: vi.fn(),
  getMyMentorProfile: vi.fn(),
  applyAsMentor: vi.fn(),
  updateMyMentorProfile: vi.fn(),
  saveAvailability: vi.fn(),
  listBookings: vi.fn(),
  requestBooking: vi.fn(),
  respondToBooking: vi.fn(),
  cancelBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  reviewBooking: vi.fn(),
  listMentorApplications: vi.fn(),
  decideMentorApplication: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}

export const mentorId = '9c8b7a6f-5e4d-4c3b-8a2f-1e0d9c8b7a6f'
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

export function fakeMentorCard() {
  return {
    id: mentorId,
    name: 'Meera Iyer',
    headline: 'Helping career switchers into data analysis',
    jobTitle: 'Senior Data Analyst',
    company: 'Acme Retail',
    yearsExperience: 7,
    expertise: ['data_analytics' as const, 'career_switching' as const],
    languages: ['English', 'Hindi'],
    sessionMinutes: 30 as const,
    isAccepting: true,
    rating: { average: 4.8, count: 5 },
    verifiedAt: '2026-10-01T00:00:00Z',
  }
}

export function fakeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    role: 'mentee' as const,
    counterpart: { id: mentorId, name: 'Meera Iyer' },
    startsAt: inHours(48),
    endsAt: inHours(48.5),
    status: 'confirmed' as const,
    topic: 'Moving from support into data analysis',
    meetingUrl: 'https://meet.example/abc',
    statusReason: null,
    reviewed: false,
    ...overrides,
  }
}

export { inHours }

export const resumeId = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'

export function fakeResume(overrides: Record<string, unknown> = {}) {
  return {
    id: resumeId,
    fileName: 'Asha Rao CV.pdf',
    sizeBytes: 120_000,
    pageCount: 1,
    createdAt: new Date().toISOString(),
    analysisCount: 0,
    ...overrides,
  }
}

export const fakeReport = {
  summary: 'A solid support background with relevant reporting experience.',
  alignment: 'partial' as const,
  strengths: [
    { point: 'Reporting experience', evidence: 'Built weekly Excel reports on ticket volumes.' },
  ],
  gaps: [{ requirement: 'Dashboard tools', suggestion: 'Add a small dashboard project.' }],
  suggestions: [{ section: 'Summary', suggestion: 'Lead with your data work.' }],
  missingKeywords: ['Tableau'],
}

export const questionId = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

export function fakeQuestion(overrides: Partial<InterviewQuestion> = {}): InterviewQuestion {
  return {
    id: questionId,
    slug: 'prioritising-competing-tasks',
    category: 'situational',
    role: 'general',
    difficulty: 'intermediate',
    prompt: 'Two managers ask you for urgent work on the same afternoon. How would you handle it?',
    guidance: 'Clarify the real deadlines and impact, and agree priorities together.',
    saved: false,
    attemptCount: 0,
    lastPractisedAt: null,
    ...overrides,
  }
}

export function fakeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    title: 'Become a data analyst',
    description: null,
    category: 'career',
    targetDate: null,
    status: 'active',
    completedAt: null,
    createdAt: '2026-10-25T00:00:00Z',
    milestones: [
      {
        id: 'm1',
        goalId: 'goal-1',
        title: 'Learn SQL',
        notes: null,
        targetDate: null,
        position: 0,
        completedAt: '2026-10-25T00:00:00Z',
      },
      {
        id: 'm2',
        goalId: 'goal-1',
        title: 'Build a portfolio project',
        notes: null,
        targetDate: null,
        position: 1,
        completedAt: null,
      },
    ],
    ...overrides,
  }
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
  fakeApi.listGoals.mockResolvedValue([])
  fakeApi.createGoal.mockImplementation(async (input) => ({
    ...fakeGoal(),
    id: 'goal-new',
    title: input.title,
    milestones: [],
  }))
  fakeApi.updateGoal.mockImplementation(async (_id, patch) => ({
    ...fakeGoal(),
    ...patch,
    completedAt: patch.status === 'completed' ? '2026-10-25T10:00:00Z' : null,
  }))
  fakeApi.deleteGoal.mockResolvedValue(undefined)
  fakeApi.goalRecommendations.mockResolvedValue([
    {
      title: 'Switching to a new career',
      sourceName: 'EverGuide starter guide (AI-drafted, pending expert review)',
      excerpt: 'Identify your transferable skills.',
    },
  ])
  fakeApi.addMilestone.mockImplementation(async (_goalId, input) => {
    const goal = fakeGoal()
    return {
      ...goal,
      milestones: [
        ...goal.milestones,
        {
          id: 'm3',
          goalId: goal.id,
          title: input.title,
          notes: null,
          targetDate: null,
          position: 2,
          completedAt: null,
        },
      ],
    }
  })
  fakeApi.updateMilestone.mockImplementation(async (id, patch) => {
    const goal = fakeGoal()
    return {
      ...goal,
      milestones: goal.milestones.map((m) =>
        m.id === id ? { ...m, completedAt: patch.completed ? '2026-10-25T10:00:00Z' : null } : m,
      ),
    }
  })
  fakeApi.listInterviewQuestions.mockResolvedValue({
    questions: [fakeQuestion()],
    progress: { practised: 0, total: 32 },
  })
  fakeApi.getInterviewQuestion.mockResolvedValue({ ...fakeQuestion(), attempts: [] })
  fakeApi.setQuestionSaved.mockResolvedValue(undefined)
  fakeApi.createPracticeAttempt.mockImplementation(async (_id, input) => ({
    id: 'attempt-1',
    questionId,
    answer: input.answer,
    createdAt: new Date().toISOString(),
    feedback: input.withFeedback
      ? {
          summary: 'A clear, calm answer that shows good judgement.',
          strengths: ['You checked deadlines with both managers.'],
          improvements: ['Say what the outcome was.'],
          suggestedStructure: 'Situation, the clash, how you agreed priorities, the result.',
        }
      : null,
  }))
  fakeApi.deletePracticeAttempt.mockResolvedValue(undefined)
  fakeApi.listResumes.mockResolvedValue([])
  fakeApi.getResume.mockResolvedValue({ ...fakeResume(), analyses: [] })
  fakeApi.uploadResume.mockImplementation(async (file: File) => fakeResume({ fileName: file.name }))
  fakeApi.deleteResume.mockResolvedValue(undefined)
  fakeApi.listMentors.mockResolvedValue([fakeMentorCard()])
  fakeApi.getMentor.mockResolvedValue({
    ...fakeMentorCard(),
    bio: 'Seven years in retail analytics.',
    timezone: 'Asia/Kolkata',
    reviews: [],
  })
  fakeApi.mentorSlots.mockResolvedValue([
    { startsAt: inHours(26), endsAt: inHours(26.5) },
    { startsAt: inHours(26.5), endsAt: inHours(27) },
  ])
  fakeApi.getMyMentorProfile.mockResolvedValue(null)
  fakeApi.applyAsMentor.mockImplementation(async (input) => ({
    ...input,
    jobTitle: input.jobTitle ?? null,
    company: input.company ?? null,
    isAccepting: true,
    verificationStatus: 'pending',
    latestApplication: {
      status: 'pending',
      submittedAt: new Date().toISOString(),
      reviewNotes: null,
    },
    availability: [],
  }))
  fakeApi.listBookings.mockResolvedValue([])
  fakeApi.requestBooking.mockResolvedValue({ id: 'booking-new' })
  fakeApi.respondToBooking.mockResolvedValue(undefined)
  fakeApi.cancelBooking.mockResolvedValue(undefined)
  fakeApi.rescheduleBooking.mockResolvedValue(undefined)
  fakeApi.reviewBooking.mockResolvedValue(undefined)
  fakeApi.listMentorApplications.mockResolvedValue([])
  fakeApi.decideMentorApplication.mockResolvedValue(undefined)
  fakeApi.listNotifications.mockResolvedValue([])
  fakeApi.markNotificationsRead.mockResolvedValue(undefined)
  fakeApi.analyseResume.mockImplementation(async (_id, input) => ({
    id: 'analysis-1',
    targetRole: input.targetRole || null,
    jobDescription: input.jobDescription || null,
    report: fakeReport,
    createdAt: new Date().toISOString(),
  }))
  fakeApi.deleteMilestone.mockImplementation(async (id) => {
    const goal = fakeGoal()
    return { ...goal, milestones: goal.milestones.filter((m) => m.id !== id) }
  })
}
