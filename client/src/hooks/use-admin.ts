import type { AdminFeedback, AuditQuery } from '@everguide/shared'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/use-auth'
import { api } from '@/lib/api'

export const adminKeys = {
  overview: (userId: string | undefined) => ['admin-overview', userId] as const,
  users: (userId: string | undefined, q: string) => ['admin-users', userId, q] as const,
  documents: (userId: string | undefined) => ['admin-documents', userId] as const,
  feedback: (userId: string | undefined, rating?: string) =>
    ['admin-feedback', userId, rating] as const,
  audit: (userId: string | undefined, area?: string) => ['admin-audit', userId, area] as const,
}

export function useAdminOverview() {
  const { user } = useAuth()
  return useQuery({ queryKey: adminKeys.overview(user?.id), queryFn: api.adminOverview })
}

export function useAdminUsers(q: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: adminKeys.users(user?.id, q),
    queryFn: () => api.adminListUsers(q || undefined),
    placeholderData: keepPreviousData,
  })
}

export function useAdminDocuments() {
  const { user } = useAuth()
  return useQuery({ queryKey: adminKeys.documents(user?.id), queryFn: api.adminListDocuments })
}

export function useAdminFeedback(rating?: AdminFeedback['rating']) {
  const { user } = useAuth()
  return useQuery({
    queryKey: adminKeys.feedback(user?.id, rating),
    queryFn: () => api.adminListFeedback(rating),
  })
}

export function useAuditLog(area?: AuditQuery['area']) {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: adminKeys.audit(user?.id, area),
    queryFn: ({ pageParam }) => api.adminAuditLog({ area, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  })
}
