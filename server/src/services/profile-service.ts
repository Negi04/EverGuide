import type {
  GuidanceDomain,
  LifeStage,
  Me,
  Onboarding,
  PrimaryGoal,
  ProfileUpdate,
  SkillLevel,
} from '@everguide/shared'
import { AppError, serviceUnavailable } from '../lib/errors.ts'
import type { Db } from '../lib/supabase.ts'

export type UserContext = { userId: string; email: string | null; accessToken: string }

export interface ProfileService {
  getMe(ctx: UserContext): Promise<Me>
  updateProfile(ctx: UserContext, input: ProfileUpdate): Promise<Me>
  saveOnboarding(ctx: UserContext, input: Onboarding): Promise<Me>
}

/**
 * All queries run as the signed-in user (user-scoped client), so Row Level Security
 * applies even here on the server.
 */
export function createProfileService(clientFor: (accessToken: string) => Db): ProfileService {
  async function getMe(ctx: UserContext): Promise<Me> {
    const db = clientFor(ctx.accessToken)
    const [profile, preferences, roles] = await Promise.all([
      db.from('profiles').select('full_name, avatar_url, timezone').eq('id', ctx.userId).maybeSingle(),
      db
        .from('user_preferences')
        .select('life_stage, primary_goals, target_career, preferred_domains, skill_level, onboarding_completed_at')
        .eq('user_id', ctx.userId)
        .maybeSingle(),
      db.from('user_roles').select('role').eq('user_id', ctx.userId),
    ])

    if (profile.error || preferences.error || roles.error) throw serviceUnavailable()
    // The signup trigger creates both rows, so a missing row means the account is broken.
    if (!profile.data || !preferences.data) {
      throw new AppError(404, 'not_found', 'Your profile could not be found.')
    }

    const p = preferences.data
    return {
      id: ctx.userId,
      email: ctx.email,
      fullName: profile.data.full_name,
      avatarUrl: profile.data.avatar_url,
      timezone: profile.data.timezone,
      roles: roles.data.map((row) => row.role),
      preferences: {
        // The database CHECK constraints guarantee these values belong to the shared lists.
        lifeStage: p.life_stage as LifeStage | null,
        primaryGoals: p.primary_goals as PrimaryGoal[],
        targetCareer: p.target_career,
        preferredDomains: p.preferred_domains as GuidanceDomain[],
        skillLevel: p.skill_level as SkillLevel | null,
      },
      onboardingCompletedAt: p.onboarding_completed_at,
    }
  }

  return {
    getMe,

    async updateProfile(ctx, input) {
      const { error } = await clientFor(ctx.accessToken)
        .from('profiles')
        .update({ full_name: input.fullName, timezone: input.timezone })
        .eq('id', ctx.userId)
      if (error) throw serviceUnavailable()
      return getMe(ctx)
    },

    async saveOnboarding(ctx, input) {
      const db = clientFor(ctx.accessToken)
      const current = await db
        .from('user_preferences')
        .select('onboarding_completed_at')
        .eq('user_id', ctx.userId)
        .maybeSingle()
      if (current.error) throw serviceUnavailable()

      const { error } = await db
        .from('user_preferences')
        .update({
          life_stage: input.lifeStage,
          primary_goals: input.primaryGoals,
          target_career: input.targetCareer,
          preferred_domains: input.preferredDomains,
          skill_level: input.skillLevel,
          // Keep the date onboarding was first completed when answers are edited later.
          onboarding_completed_at: current.data?.onboarding_completed_at ?? new Date().toISOString(),
        })
        .eq('user_id', ctx.userId)
      if (error) throw serviceUnavailable()
      return getMe(ctx)
    },
  }
}
