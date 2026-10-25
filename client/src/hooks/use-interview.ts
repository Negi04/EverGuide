import type { InterviewCategory, InterviewRole } from '@everguide/shared'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/use-auth'
import { api } from '@/lib/api'

export type InterviewFilters = {
  role?: InterviewRole
  category?: InterviewCategory
  saved?: boolean
}

export const interviewKeys = {
  all: (userId: string | undefined) => ['interview', userId] as const,
  list: (userId: string | undefined, filters: InterviewFilters) =>
    ['interview', userId, 'list', filters] as const,
  question: (userId: string | undefined, id: string) =>
    ['interview', userId, 'question', id] as const,
}

export function useInterviewQuestions(filters: InterviewFilters) {
  const { user } = useAuth()
  return useQuery({
    queryKey: interviewKeys.list(user?.id, filters),
    queryFn: () => api.listInterviewQuestions(filters),
    enabled: Boolean(user),
  })
}

export function useInterviewQuestion(id: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: interviewKeys.question(user?.id, id),
    queryFn: () => api.getInterviewQuestion(id),
    enabled: Boolean(user),
  })
}
