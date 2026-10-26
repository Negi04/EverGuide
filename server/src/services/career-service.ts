import type {
  Goal,
  GoalCategory,
  GoalCreate,
  GoalUpdate,
  Milestone,
  MilestoneCreate,
  MilestoneUpdate,
  Recommendation,
} from '@everguide/shared'
import { AppError, databaseError } from '../lib/errors.ts'
import type { Db } from '../lib/supabase.ts'
import type { Retriever } from '../rag/retriever.ts'
import type { UserContext } from './profile-service.ts'

export interface CareerService {
  listGoals(ctx: UserContext): Promise<Goal[]>
  createGoal(ctx: UserContext, input: GoalCreate): Promise<Goal>
  updateGoal(ctx: UserContext, goalId: string, patch: GoalUpdate): Promise<Goal>
  deleteGoal(ctx: UserContext, goalId: string): Promise<void>
  addMilestone(ctx: UserContext, goalId: string, input: MilestoneCreate): Promise<Goal>
  updateMilestone(ctx: UserContext, milestoneId: string, patch: MilestoneUpdate): Promise<Goal>
  deleteMilestone(ctx: UserContext, milestoneId: string): Promise<Goal>
  recommendations(ctx: UserContext, goalId: string): Promise<Recommendation[]>
}

const MAX_ACTIVE_GOALS = 30
const MAX_MILESTONES = 30
const GOAL_COLUMNS =
  'id, title, description, category, target_date, status, completed_at, created_at'
const MILESTONE_COLUMNS = 'id, goal_id, title, notes, target_date, position, completed_at'

const goalNotFound = () => new AppError(404, 'not_found', 'Goal not found.')

type GoalRow = {
  id: string
  title: string
  description: string | null
  category: string
  target_date: string | null
  status: Goal['status']
  completed_at: string | null
  created_at: string
}
type MilestoneRow = {
  id: string
  goal_id: string
  title: string
  notes: string | null
  target_date: string | null
  position: number
  completed_at: string | null
}

const toMilestone = (m: MilestoneRow): Milestone => ({
  id: m.id,
  goalId: m.goal_id,
  title: m.title,
  notes: m.notes,
  targetDate: m.target_date,
  position: m.position,
  completedAt: m.completed_at,
})

const toGoal = (g: GoalRow, milestones: MilestoneRow[]): Goal => ({
  id: g.id,
  title: g.title,
  description: g.description,
  category: g.category as GoalCategory, // guaranteed by the CHECK constraint
  targetDate: g.target_date,
  status: g.status,
  completedAt: g.completed_at,
  createdAt: g.created_at,
  milestones: milestones
    .filter((m) => m.goal_id === g.id)
    .sort((a, b) => a.position - b.position)
    .map(toMilestone),
})

/**
 * Roadmap goals and milestones. Everything runs as the signed-in user, so RLS (plus the
 * composite foreign key on milestones) keeps each user's roadmap private.
 */
export function createCareerService(
  clientFor: (accessToken: string) => Db,
  retriever: Retriever | null,
): CareerService {
  async function loadGoals(ctx: UserContext, goalId?: string): Promise<Goal[]> {
    const db = clientFor(ctx.accessToken)
    let goalsQuery = db
      .from('goals')
      .select(GOAL_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(100)
    if (goalId) goalsQuery = goalsQuery.eq('id', goalId)
    const goals = await goalsQuery
    if (goals.error) throw databaseError(goals.error)
    if (goals.data.length === 0) return []
    const milestones = await db
      .from('milestones')
      .select(MILESTONE_COLUMNS)
      .in(
        'goal_id',
        goals.data.map((g) => g.id),
      )
    if (milestones.error) throw databaseError(milestones.error)
    return goals.data.map((g) => toGoal(g, milestones.data))
  }

  async function getGoal(ctx: UserContext, goalId: string): Promise<Goal> {
    const [goal] = await loadGoals(ctx, goalId)
    if (!goal) throw goalNotFound()
    return goal
  }

  return {
    listGoals: (ctx) => loadGoals(ctx),

    async createGoal(ctx, input) {
      const db = clientFor(ctx.accessToken)
      const active = await db
        .from('goals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
      if (active.error) throw databaseError(active.error)
      if ((active.count ?? 0) >= MAX_ACTIVE_GOALS) {
        throw new AppError(
          409,
          'validation_failed',
          `You can have up to ${MAX_ACTIVE_GOALS} active goals. Complete or archive one first.`,
        )
      }

      const created = await db
        .from('goals')
        .insert({
          user_id: ctx.userId,
          title: input.title,
          description: input.description ?? null,
          category: input.category ?? 'career',
          target_date: input.targetDate ?? null,
        })
        .select('id')
        .single()
      if (created.error) throw databaseError(created.error)

      const milestones = input.milestones ?? []
      if (milestones.length > 0) {
        const inserted = await db.from('milestones').insert(
          milestones.map((m, position) => ({
            goal_id: created.data.id,
            user_id: ctx.userId,
            title: m.title,
            target_date: m.targetDate ?? null,
            position,
          })),
        )
        if (inserted.error) {
          // Don't leave a half-created goal behind.
          await db.from('goals').delete().eq('id', created.data.id)
          throw databaseError(inserted.error)
        }
      }
      return getGoal(ctx, created.data.id)
    },

    async updateGoal(ctx, goalId, patch) {
      const completedAt =
        patch.status === undefined
          ? undefined
          : patch.status === 'completed'
            ? new Date().toISOString()
            : null
      const { data, error } = await clientFor(ctx.accessToken)
        .from('goals')
        .update({
          title: patch.title,
          description: patch.description,
          category: patch.category,
          target_date: patch.targetDate,
          status: patch.status,
          completed_at: completedAt,
        })
        .eq('id', goalId)
        .select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw goalNotFound()
      return getGoal(ctx, goalId)
    },

    async deleteGoal(ctx, goalId) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('goals')
        .delete()
        .eq('id', goalId)
        .select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw goalNotFound()
    },

    async addMilestone(ctx, goalId, input) {
      const goal = await getGoal(ctx, goalId)
      if (goal.milestones.length >= MAX_MILESTONES) {
        throw new AppError(
          409,
          'validation_failed',
          `A goal can have up to ${MAX_MILESTONES} milestones.`,
        )
      }
      const position = Math.max(-1, ...goal.milestones.map((m) => m.position)) + 1
      const { error } = await clientFor(ctx.accessToken)
        .from('milestones')
        .insert({
          goal_id: goalId,
          user_id: ctx.userId,
          title: input.title,
          target_date: input.targetDate ?? null,
          position,
        })
      if (error) throw databaseError(error)
      return getGoal(ctx, goalId)
    },

    async updateMilestone(ctx, milestoneId, patch) {
      const completedAt =
        patch.completed === undefined
          ? undefined
          : patch.completed
            ? new Date().toISOString()
            : null
      const { data, error } = await clientFor(ctx.accessToken)
        .from('milestones')
        .update({
          title: patch.title,
          notes: patch.notes,
          target_date: patch.targetDate,
          completed_at: completedAt,
        })
        .eq('id', milestoneId)
        .select('goal_id')
      if (error) throw databaseError(error)
      const goalId = data[0]?.goal_id
      if (!goalId) throw new AppError(404, 'not_found', 'Milestone not found.')
      return getGoal(ctx, goalId)
    },

    async deleteMilestone(ctx, milestoneId) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('milestones')
        .delete()
        .eq('id', milestoneId)
        .select('goal_id')
      if (error) throw databaseError(error)
      const goalId = data[0]?.goal_id
      if (!goalId) throw new AppError(404, 'not_found', 'Milestone not found.')
      return getGoal(ctx, goalId)
    },

    async recommendations(ctx, goalId) {
      const goal = await getGoal(ctx, goalId)
      if (!retriever) return []
      // Same semantic search as the AI Guide, so suggestions come from approved guides only.
      const chunks = await retriever.search(
        [goal.title, goal.description].filter(Boolean).join('. '),
      )
      const seen = new Set<string>()
      const results: Recommendation[] = []
      for (const chunk of chunks) {
        if (seen.has(chunk.title)) continue
        seen.add(chunk.title)
        results.push({
          title: chunk.title,
          sourceName: chunk.sourceName,
          excerpt:
            chunk.content.length > 220
              ? `${chunk.content.slice(0, 217).trimEnd()}…`
              : chunk.content,
        })
        if (results.length === 3) break
      }
      return results
    },
  }
}
