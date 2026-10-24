import type { Me } from '@everguide/shared'
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

export const fakeApi = {
  getMe: vi.fn(),
  updateProfile: vi.fn(),
  saveOnboarding: vi.fn(),
  deleteAccount: vi.fn(),
  submitContact: vi.fn(),
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
}
