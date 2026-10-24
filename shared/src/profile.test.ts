import { describe, expect, it } from 'vitest'
import { onboardingSchema, profileUpdateSchema } from './profile.ts'

const valid = {
  lifeStage: 'college_student',
  primaryGoals: ['find_first_job'],
  targetCareer: '  Data analyst  ',
  preferredDomains: ['career', 'finance'],
  skillLevel: 'beginner',
}

describe('onboardingSchema', () => {
  it('accepts valid answers and trims the target career', () => {
    expect(onboardingSchema.parse(valid).targetCareer).toBe('Data analyst')
  })

  it('stores an empty target career as null', () => {
    expect(onboardingSchema.parse({ ...valid, targetCareer: '   ' }).targetCareer).toBeNull()
  })

  it('rejects duplicate goals', () => {
    const result = onboardingSchema.safeParse({
      ...valid,
      primaryGoals: ['find_first_job', 'find_first_job'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects domains the database does not allow', () => {
    expect(onboardingSchema.safeParse({ ...valid, preferredDomains: ['astrology'] }).success).toBe(
      false,
    )
  })

  it('drops unknown fields such as a role (no mass assignment)', () => {
    const parsed = onboardingSchema.parse({ ...valid, role: 'admin' })
    expect(parsed).not.toHaveProperty('role')
  })
})

describe('profileUpdateSchema', () => {
  it('accepts a valid IANA time zone', () => {
    expect(profileUpdateSchema.safeParse({ timezone: 'Asia/Kolkata' }).success).toBe(true)
  })

  it('rejects an invalid time zone', () => {
    expect(profileUpdateSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false)
  })

  it('rejects an empty update', () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(false)
  })
})
