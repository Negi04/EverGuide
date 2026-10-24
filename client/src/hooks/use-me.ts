import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/use-auth'
import { api } from '@/lib/api'

export const meQueryKey = (userId: string | undefined) => ['me', userId] as const

/** The signed-in user's profile, roles and onboarding answers from the API. */
export function useMe() {
  const { status, user } = useAuth()
  return useQuery({
    queryKey: meQueryKey(user?.id),
    queryFn: api.getMe,
    enabled: status === 'signed-in',
  })
}
