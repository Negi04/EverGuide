import type { ChatMessage, ConversationDetail, ConversationSummary } from '@everguide/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { useAuth } from '@/auth/use-auth'
import { aiKeys } from '@/hooks/use-ai'
import { api, ApiError } from '@/lib/api'

export type PendingTurn = {
  question: string
  userMessage: ChatMessage | null
  streamingText: string
}
export type ChatError = { message: string; question: string; retryable: boolean }

/**
 * Sends a question and follows the streamed answer. Finished messages go into the
 * conversation's query cache; the in-progress turn lives in local state, because the
 * server only keeps a turn once it completes successfully.
 */
export function useChat(conversationId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [pending, setPending] = useState<PendingTurn | null>(null)
  const [error, setError] = useState<ChatError | null>(null)
  const [followUps, setFollowUps] = useState<string[]>([])
  // Answers keep streaming if the user navigates away (they land in the cache);
  // only the Stop button cancels one.
  const controllerRef = useRef<AbortController | null>(null)

  const send = useCallback(
    async (question: string) => {
      const conversationKey = aiKeys.conversation(user?.id, conversationId)
      const controller = new AbortController()
      controllerRef.current = controller
      setError(null)
      setFollowUps([])
      setPending({ question, userMessage: null, streamingText: '' })

      let userMessage: ChatMessage | null = null
      let finished = false
      try {
        await api.streamMessage(conversationId, question, {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === 'start') {
              userMessage = event.userMessage
              setPending((p) => p && { ...p, userMessage: event.userMessage })
              updateSummary(event.conversation)
              // The server titles new conversations at this point; refresh the sidebar now.
              void queryClient.invalidateQueries({ queryKey: aiKeys.allConversations(user?.id) })
            } else if (event.type === 'delta') {
              setPending((p) => p && { ...p, streamingText: p.streamingText + event.text })
            } else if (event.type === 'done') {
              finished = true
              const answered = userMessage
              queryClient.setQueryData<ConversationDetail>(conversationKey, (old) =>
                old && answered
                  ? { ...old, messages: [...old.messages, answered, event.message] }
                  : old,
              )
              queryClient.setQueryData(aiKeys.usage(user?.id), event.usage)
              setPending(null)
            } else if (event.type === 'followups') {
              setFollowUps(event.questions)
            } else {
              finished = true
              setError({ message: event.message, question, retryable: true })
              setPending(null)
            }
          },
        })
        if (!finished) {
          setError({
            message: 'The answer was interrupted. Please try again.',
            question,
            retryable: true,
          })
          setPending(null)
        }
      } catch (caught) {
        setPending(null)
        if (controller.signal.aborted) return
        const quota = caught instanceof ApiError && caught.code === 'quota_exceeded'
        setError({
          message:
            caught instanceof Error ? caught.message : 'Something went wrong. Please try again.',
          question,
          retryable: !quota,
        })
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null
        void queryClient.invalidateQueries({ queryKey: aiKeys.allConversations(user?.id) })
      }

      function updateSummary(summary: ConversationSummary) {
        queryClient.setQueryData<ConversationDetail>(
          conversationKey,
          (old) => old && { ...old, ...summary },
        )
      }
    },
    [conversationId, queryClient, user?.id],
  )

  /** Stop the answer. The server discards the turn, so the question goes back to the composer. */
  const stop = useCallback(() => controllerRef.current?.abort(), [])

  return { pending, error, followUps, send, stop, dismissError: () => setError(null) }
}
