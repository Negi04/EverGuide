import type { Goal } from '@everguide/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useAuth } from '@/auth/use-auth'
import { api } from '@/lib/api'

export const careerKeys = {
  goals: (userId: string | undefined) => ['goals', userId] as const,
  recommendations: (userId: string | undefined, goalId: string) =>
    ['goal-recommendations', userId, goalId] as const,
}

export function useGoals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: careerKeys.goals(user?.id),
    queryFn: api.listGoals,
    enabled: Boolean(user),
  })
}

/** Replace one goal in the cached list (the API returns the whole goal after every change). */
export function useReplaceGoal() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useCallback(
    (goal: Goal) =>
      queryClient.setQueryData<Goal[]>(careerKeys.goals(user?.id), (old) =>
        old ? old.map((g) => (g.id === goal.id ? goal : g)) : old,
      ),
    [queryClient, user?.id],
  )
}

export function goalProgress(goal: Goal): { done: number; total: number; percent: number } {
  const total = goal.milestones.length
  const done = goal.milestones.filter((m) => m.completedAt).length
  const percent =
    goal.status === 'completed' ? 100 : total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, percent }
}

export function isOverdue(isoDate: string | null, today = new Date()): boolean {
  if (!isoDate) return false
  const local = today.toLocaleDateString('en-CA') // YYYY-MM-DD in the user's time zone
  return isoDate < local
}
