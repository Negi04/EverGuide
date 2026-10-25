import type { MentorExpertise } from '@everguide/shared'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/use-auth'
import { api } from '@/lib/api'

export const mentorKeys = {
  directory: (filters: object) => ['mentors', 'directory', filters] as const,
  detail: (id: string) => ['mentors', 'detail', id] as const,
  slots: (id: string) => ['mentors', 'slots', id] as const,
  own: (userId: string | undefined) => ['mentors', 'own', userId] as const,
  bookings: (userId: string | undefined) => ['bookings', userId] as const,
  applications: (userId: string | undefined) => ['admin', 'mentor-applications', userId] as const,
  notifications: (userId: string | undefined) => ['notifications', userId] as const,
}

export function useMentorDirectory(filters: { expertise?: MentorExpertise; q?: string }) {
  return useQuery({
    queryKey: mentorKeys.directory(filters),
    queryFn: () => api.listMentors(filters),
  })
}

export function useMentor(id: string) {
  return useQuery({ queryKey: mentorKeys.detail(id), queryFn: () => api.getMentor(id) })
}

export function useMentorSlots(id: string, enabled = true) {
  return useQuery({ queryKey: mentorKeys.slots(id), queryFn: () => api.mentorSlots(id), enabled })
}

export function useMyMentorProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: mentorKeys.own(user?.id),
    queryFn: api.getMyMentorProfile,
    enabled: Boolean(user),
  })
}

export function useBookings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: mentorKeys.bookings(user?.id),
    queryFn: api.listBookings,
    enabled: Boolean(user),
  })
}

export function useNotifications() {
  const { user } = useAuth()
  return useQuery({
    queryKey: mentorKeys.notifications(user?.id),
    queryFn: api.listNotifications,
    enabled: Boolean(user),
    refetchInterval: 60_000, // simple polling; push notifications arrive with n8n in Phase 6
  })
}
