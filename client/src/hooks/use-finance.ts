import type { Budget, SavingsGoal } from '@everguide/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useAuth } from '@/auth/use-auth'
import { api } from '@/lib/api'

export const financeKeys = {
  budget: (userId: string | undefined, month: string) => ['budget', userId, month] as const,
  goals: (userId: string | undefined) => ['savings-goals', userId] as const,
}

export function useBudget(month: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: financeKeys.budget(user?.id, month),
    queryFn: () => api.getBudget(month),
    enabled: Boolean(user),
  })
}

/** Every budget change returns the whole month, so the cache is simply replaced. */
export function useSetBudget() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useCallback(
    (budget: Budget) =>
      queryClient.setQueryData(financeKeys.budget(user?.id, budget.month), budget),
    [queryClient, user?.id],
  )
}

export function useSavingsGoals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: financeKeys.goals(user?.id),
    queryFn: api.listSavingsGoals,
    enabled: Boolean(user),
  })
}

/** Replace, add or remove one goal in the cached list. */
export function useUpdateGoalCache() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useCallback(
    (change: { put: SavingsGoal } | { remove: string }) =>
      queryClient.setQueryData<SavingsGoal[]>(financeKeys.goals(user?.id), (old) => {
        if (!old) return old
        if ('remove' in change) return old.filter((g) => g.id !== change.remove)
        return old.some((g) => g.id === change.put.id)
          ? old.map((g) => (g.id === change.put.id ? change.put : g))
          : [...old, change.put]
      }),
    [queryClient, user?.id],
  )
}
