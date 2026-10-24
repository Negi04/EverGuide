import { z } from 'zod'

// These lists must match the CHECK constraints in
// database/migrations/20261024000001_identity_and_onboarding.sql.
export const lifeStages = [
  'school_student',
  'college_student',
  'recent_graduate',
  'early_career',
  'mid_career',
  'career_changer',
  'other',
] as const

export const skillLevels = ['beginner', 'intermediate', 'advanced'] as const

export const guidanceDomains = [
  'career',
  'interview',
  'mental_wellness',
  'physical_wellness',
  'finance',
  'personal_development',
] as const

export const primaryGoalOptions = [
  'choose_a_path',
  'find_first_job',
  'switch_careers',
  'grow_in_current_role',
  'prepare_for_interviews',
  'build_skills',
  'manage_stress',
  'build_healthy_habits',
  'manage_money',
] as const

export const appRoles = ['user', 'mentor', 'admin'] as const

export type LifeStage = (typeof lifeStages)[number]
export type SkillLevel = (typeof skillLevels)[number]
export type GuidanceDomain = (typeof guidanceDomains)[number]
export type PrimaryGoal = (typeof primaryGoalOptions)[number]
export type AppRole = (typeof appRoles)[number]

const unique = <T>(values: T[]) => new Set(values).size === values.length

export const onboardingSchema = z.object({
  lifeStage: z.enum(lifeStages, { error: 'Choose the stage that fits you best.' }),
  primaryGoals: z
    .array(z.enum(primaryGoalOptions))
    .min(1, 'Choose at least one goal.')
    .max(5, 'Choose up to five goals.')
    .refine(unique, 'Each goal can only be chosen once.'),
  targetCareer: z
    .string()
    .trim()
    .max(120, 'Keep this under 120 characters.')
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .default(null),
  preferredDomains: z
    .array(z.enum(guidanceDomains))
    .min(1, 'Choose at least one area.')
    .refine(unique, 'Each area can only be chosen once.'),
  skillLevel: z.enum(skillLevels, { error: 'Choose your current level.' }),
})

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export const profileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Please enter your name.').max(80),
    timezone: z.string().refine(isValidTimeZone, 'Choose a valid time zone.'),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

export type OnboardingInput = z.input<typeof onboardingSchema>
export type Onboarding = z.output<typeof onboardingSchema>
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

/** Response of GET /api/v1/me. */
export type Me = {
  id: string
  email: string | null
  fullName: string
  avatarUrl: string | null
  timezone: string
  roles: AppRole[]
  preferences: {
    lifeStage: LifeStage | null
    primaryGoals: PrimaryGoal[]
    targetCareer: string | null
    preferredDomains: GuidanceDomain[]
    skillLevel: SkillLevel | null
  }
  onboardingCompletedAt: string | null
}

/** Body of DELETE /api/v1/me — an explicit confirmation guards against accidental calls. */
export const deleteAccountSchema = z.object({
  confirm: z.literal('DELETE', { error: 'Type DELETE to confirm.' }),
})
