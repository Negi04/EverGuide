import type { ContactMessage, Me, Onboarding, ProfileUpdate } from '@everguide/shared'
import type { CareerService } from '../src/services/career-service.ts'
import type { InterviewService } from '../src/services/interview-service.ts'
import type { MentorService } from '../src/services/mentor-service.ts'
import type { NotificationService } from '../src/services/notification-service.ts'
import type { WellnessService } from '../src/services/wellness-service.ts'
import type { ResumeService } from '../src/services/resume-service.ts'
import { pino } from 'pino'
import { createApp, type AppDeps } from '../src/app.ts'
import type { AuthUser } from '../src/services/auth-service.ts'
import type { UserContext } from '../src/services/profile-service.ts'

export const ALLOWED_ORIGIN = 'http://localhost:5173'
// Shaped like a JWT (three dot-separated segments); the fake auth service accepts only this.
export const VALID_TOKEN = 'header.payload.signature'
export const testUser: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'asha@example.com',
}

export function baseMe(): Me {
  return {
    id: testUser.id,
    email: testUser.email,
    fullName: 'Asha',
    avatarUrl: null,
    timezone: 'Asia/Kolkata',
    roles: ['user'],
    preferences: {
      lifeStage: null,
      primaryGoals: [],
      targetCareer: null,
      preferredDomains: [],
      skillLevel: null,
    },
    onboardingCompletedAt: null,
  }
}

/** Builds the real app with in-memory fakes and records what the services were asked to do. */
export function buildTestApp(overrides: Partial<AppDeps> = {}) {
  const calls = {
    contact: [] as ContactMessage[],
    getMe: [] as UserContext[],
    updateProfile: [] as { ctx: UserContext; input: ProfileUpdate }[],
    saveOnboarding: [] as { ctx: UserContext; input: Onboarding }[],
    deleteAccount: [] as string[],
  }

  const deps: AppDeps = {
    config: { corsOrigins: [ALLOWED_ORIGIN], trustProxy: 0 },
    logger: pino({ level: 'silent' }),
    auth: {
      verifyAccessToken: async (token) => (token === VALID_TOKEN ? testUser : null),
      getRoles: async () => ['user'],
    },
    profiles: {
      getMe: async (ctx) => {
        calls.getMe.push(ctx)
        return baseMe()
      },
      updateProfile: async (ctx, input) => {
        calls.updateProfile.push({ ctx, input })
        return { ...baseMe(), ...(input.fullName && { fullName: input.fullName }) }
      },
      saveOnboarding: async (ctx, input) => {
        calls.saveOnboarding.push({ ctx, input })
        return { ...baseMe(), onboardingCompletedAt: '2026-10-24T00:00:00.000Z' }
      },
    },
    accounts: {
      deleteAccount: async (userId) => {
        calls.deleteAccount.push(userId)
      },
    },
    aiGuide: null,
    career: unusedService<CareerService>('career'),
    interview: unusedService<InterviewService>('interview'),
    resumes: unusedService<ResumeService>('resumes'),
    mentors: unusedService<MentorService>('mentors'),
    notifications: unusedService<NotificationService>('notifications'),
    wellness: unusedService<WellnessService>('wellness'),
    contact: {
      submit: async (message) => {
        calls.contact.push(message)
        return { id: 'contact-1' }
      },
    },
    checkDatabase: async () => true,
    ...overrides,
  }

  return { app: createApp(deps), calls }
}

/** A stand-in for services a test doesn't use: any call fails loudly. */
export function unusedService<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get: (_target, method) => () => {
      throw new Error(`Unexpected call to ${name}.${String(method)} in this test`)
    },
  })
}
