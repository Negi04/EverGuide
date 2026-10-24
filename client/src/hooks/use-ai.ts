import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/use-auth'
import { api } from '@/lib/api'

// Keys include the user ID so cached data can never leak between accounts on one device.
export const aiKeys = {
  conversations: (userId: string | undefined, search = '') =>
    ['conversations', userId, search] as const,
  allConversations: (userId: string | undefined) => ['conversations', userId] as const,
  conversation: (userId: string | undefined, id: string) => ['conversation', userId, id] as const,
  usage: (userId: string | undefined) => ['ai-usage', userId] as const,
}

export function useConversations(search = '') {
  const { user } = useAuth()
  return useQuery({
    queryKey: aiKeys.conversations(user?.id, search),
    queryFn: () => api.listConversations(search || undefined),
    enabled: Boolean(user),
  })
}

export function useConversation(id: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: aiKeys.conversation(user?.id, id),
    queryFn: () => api.getConversation(id),
    enabled: Boolean(user),
  })
}

export function useUsage() {
  const { user } = useAuth()
  return useQuery({
    queryKey: aiKeys.usage(user?.id),
    queryFn: api.getUsage,
    enabled: Boolean(user),
  })
}
