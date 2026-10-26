import type { Habit, HabitList } from '@everguide/shared'
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useAuth } from '@/auth/use-auth'
import { api } from '@/lib/api'

export const wellnessKeys = {
  journal: (userId: string | undefined) => ['journal', userId] as const,
  journalSearch: (userId: string | undefined, q: string) => ['journal', userId, q] as const,
  habits: (userId: string | undefined) => ['habits', userId] as const,
}

/** Journal entries, newest first, loaded a page at a time. */
export function useJournal(q: string) {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: wellnessKeys.journalSearch(user?.id, q),
    queryFn: ({ pageParam }) => api.listJournal({ q: q || undefined, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    // Keep showing the current results while a new search loads, instead of a spinner.
    placeholderData: keepPreviousData,
    enabled: Boolean(user),
  })
}

export function useHabits() {
  const { user } = useAuth()
  return useQuery({
    queryKey: wellnessKeys.habits(user?.id),
    queryFn: api.listHabits,
    enabled: Boolean(user),
  })
}

/** Replace, add or remove one habit in the cached list (the API returns the whole habit). */
export function useUpdateHabitCache() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useCallback(
    (change: { put: Habit } | { remove: string }) =>
      queryClient.setQueryData<HabitList>(wellnessKeys.habits(user?.id), (old) => {
        if (!old) return old
        if ('remove' in change)
          return { ...old, habits: old.habits.filter((h) => h.id !== change.remove) }
        const exists = old.habits.some((h) => h.id === change.put.id)
        return {
          ...old,
          habits: exists
            ? old.habits.map((h) => (h.id === change.put.id ? change.put : h))
            : [...old.habits, change.put],
        }
      }),
    [queryClient, user?.id],
  )
}
