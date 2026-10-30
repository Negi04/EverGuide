import type { ChatMessage, Citation, ConversationDetail, FeedbackRating } from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpenCheck,
  Check,
  Copy,
  HeartHandshake,
  Info,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/use-auth'
import { aiKeys } from '@/hooks/use-ai'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { MessageContent } from './message-content'

export function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-lg rounded-br-sm bg-primary px-4 py-3 text-[0.95rem] leading-relaxed whitespace-pre-wrap text-primary-foreground">
        {content}
      </div>
    </div>
  )
}

type AssistantProps = {
  message: ChatMessage
  conversationId: string
  onCite: (citation: Citation) => void
}

export function AssistantMessage({ message, conversationId, onCite }: AssistantProps) {
  const crisis = message.safetyFlag === 'crisis'
  const numbers = message.citations.map((c) => c.number)
  const openCitation = (n: number) => {
    const citation = message.citations.find((c) => c.number === n)
    if (citation) onCite(citation)
  }

  return (
    <article
      aria-label="AI Guide answer"
      className={cn(
        'max-w-[92%] rounded-lg border bg-surface p-4 sm:p-5',
        crisis ? 'border-amber-400/70 bg-warn-bg' : 'border-border',
      )}
    >
      <AnswerLabel message={message} />
      <div className="mt-3">
        <MessageContent content={message.content} citationNumbers={numbers} onCite={openCitation} />
      </div>

      {message.citations.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Sources
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {message.citations.map((citation) => (
              <li key={citation.number}>
                <button
                  type="button"
                  onClick={() => onCite(citation)}
                  className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  <span className="font-semibold text-accent-fg">{citation.number}</span>
                  <span className="truncate">{citation.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MessageActions message={message} conversationId={conversationId} />
    </article>
  )
}

function AnswerLabel({ message }: { message: ChatMessage }) {
  if (message.safetyFlag === 'crisis') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-warn-fg">
        <HeartHandshake className="size-3.5" aria-hidden /> Support information
      </p>
    )
  }
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="flex items-center gap-1.5 font-semibold text-accent-fg">
        <Sparkles className="size-3.5" aria-hidden /> AI-generated
      </span>
      {message.grounded ? (
        <span className="flex items-center gap-1 text-success">
          <BookOpenCheck className="size-3.5" aria-hidden />
          {groundingLabel(message)}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-warn-fg">
          <Info className="size-3.5" aria-hidden />
          Not based on EverGuide sources — check important information
        </span>
      )}
    </p>
  )
}

function MessageActions({
  message,
  conversationId,
}: {
  message: ChatMessage
  conversationId: string
}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

  const rate = useMutation({
    mutationFn: (rating: FeedbackRating) => api.sendFeedback(message.id, { rating }),
    // Optimistic update: show the choice immediately, roll back if the request fails.
    onMutate: (rating) => setFeedback(rating),
    onError: () => setFeedback(message.feedback),
  })

  function setFeedback(rating: FeedbackRating | null) {
    queryClient.setQueryData<ConversationDetail>(
      aiKeys.conversation(user?.id, conversationId),
      (old) =>
        old && {
          ...old,
          messages: old.messages.map((m) => (m.id === message.id ? { ...m, feedback: rating } : m)),
        },
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-4 flex items-center gap-1 border-t border-border pt-3 text-muted-foreground">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-surface-muted hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span className="ml-auto text-xs">Was this helpful?</span>
      {(['helpful', 'not_helpful'] as const).map((rating) => {
        const Icon = rating === 'helpful' ? ThumbsUp : ThumbsDown
        const selected = message.feedback === rating
        return (
          <button
            key={rating}
            type="button"
            aria-pressed={selected}
            aria-label={rating === 'helpful' ? 'Helpful' : 'Not helpful'}
            onClick={() => rate.mutate(rating)}
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-muted hover:text-foreground',
              selected && 'bg-accent-subtle text-accent-fg',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

/** The answer while it is still being written. */
export function StreamingMessage({ text }: { text: string }) {
  return (
    <article
      aria-label="AI Guide is answering"
      aria-busy="true"
      className="max-w-[92%] rounded-lg border border-border bg-surface p-4 sm:p-5"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-fg">
        <Sparkles className="size-3.5" aria-hidden /> AI-generated
      </p>
      <div className="mt-3">
        {text ? (
          <MessageContent content={text} />
        ) : (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Searching EverGuide sources
            <span className="inline-flex gap-0.5" aria-hidden>
              <span className="size-1 rounded-full bg-current motion-safe:animate-pulse" />
              <span className="size-1 rounded-full bg-current motion-safe:animate-pulse [animation-delay:150ms]" />
              <span className="size-1 rounded-full bg-current motion-safe:animate-pulse [animation-delay:300ms]" />
            </span>
          </p>
        )}
      </div>
    </article>
  )
}

/** "Based on 1 EverGuide guide (3 passages)": counts guides, not passages, to avoid overstating. */
function groundingLabel(message: ChatMessage): string {
  const guides = new Set(message.citations.map((c) => c.title)).size
  const passages = message.citations.length
  const base = `Based on ${guides} EverGuide ${guides === 1 ? 'guide' : 'guides'}`
  return passages > guides ? `${base} (${passages} passages)` : base
}
