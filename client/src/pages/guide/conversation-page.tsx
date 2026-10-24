import {
  guidanceDomains,
  type Citation,
  type ConversationDetail,
  type ConversationSummary,
  type GuidanceDomain,
} from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquareOff, PencilLine, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { EmptyState } from '@/components/common/empty-state'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, NativeSelect } from '@/components/ui/input'
import { starterQuestions } from '@/config/guide'
import { domainLabels } from '@/config/onboarding'
import { aiKeys, useConversation } from '@/hooks/use-ai'
import { usePageTitle } from '@/hooks/use-page-title'
import { api, ApiError } from '@/lib/api'
import { Composer } from './composer'
import { AssistantMessage, StreamingMessage, UserBubble } from './message-bubble'
import { SourceSheet } from './source-sheet'
import { useChat } from './use-chat'
import { Disclaimer, UsageNote } from './workspace-notes'

export default function ConversationPage() {
  const { conversationId = '' } = useParams()
  const conversation = useConversation(conversationId)
  usePageTitle(conversation.data?.title ?? 'AI Guide')

  if (conversation.isPending) return <PageLoader label="Loading conversation…" />
  if (conversation.isError) {
    const missing = conversation.error instanceof ApiError && conversation.error.status === 404
    return (
      <div className="p-6">
        <EmptyState
          icon={MessageSquareOff}
          title={missing ? 'Conversation not found' : 'We couldn’t load this conversation'}
          action={
            <Button variant="outline" asChild>
              <Link to="/app/guide">Start a new conversation</Link>
            </Button>
          }
        >
          <p>{missing ? 'It may have been deleted.' : conversation.error.message}</p>
        </EmptyState>
      </div>
    )
  }
  // Keyed so switching conversations resets the chat state.
  return <Chat key={conversationId} conversation={conversation.data} />
}

function Chat({ conversation }: { conversation: ConversationDetail }) {
  const chat = useChat(conversation.id)
  const location = useLocation()
  const navigate = useNavigate()
  const [citation, setCitation] = useState<Citation | null>(null)
  const [restore, setRestore] = useState<{ text: string; key: number } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const sentInitial = useRef(false)

  // A question typed on the "new conversation" page arrives in navigation state.
  const initialQuestion = (location.state as { question?: string } | null)?.question
  useEffect(() => {
    if (!initialQuestion || sentInitial.current) return
    sentInitial.current = true
    navigate('.', { replace: true, state: null })
    void chat.send(initialQuestion)
  }, [initialQuestion, navigate, chat])

  // Keep the newest content in view while an answer streams in.
  const lastMessageId = conversation.messages.at(-1)?.id
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [lastMessageId, chat.pending?.streamingText, chat.pending?.userMessage])

  const stop = () => {
    const question = chat.pending?.question
    chat.stop()
    if (question) setRestore({ text: question, key: Date.now() })
  }

  const busy = chat.pending !== null
  const empty = conversation.messages.length === 0 && !busy
  const lastAnswer = conversation.messages.at(-1)
  const quotaReached = chat.error !== null && !chat.error.retryable

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConversationHeader conversation={conversation} />

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
          {empty && (
            <div className="py-8">
              <h2 className="text-lg font-semibold text-ink">Ask your first question</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                {starterQuestions[conversation.domain].map((question) => (
                  <li key={question}>
                    <button
                      type="button"
                      onClick={() => void chat.send(question)}
                      className="h-full w-full rounded-md border border-border bg-surface p-3 text-left text-sm hover:border-primary"
                    >
                      {question}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {conversation.messages.map((message) =>
            message.role === 'user' ? (
              <UserBubble key={message.id} content={message.content} />
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                conversationId={conversation.id}
                onCite={setCitation}
              />
            ),
          )}

          {chat.pending && (
            <>
              <UserBubble content={chat.pending.question} />
              <StreamingMessage text={chat.pending.streamingText} />
            </>
          )}

          {!busy && chat.followUps.length > 0 && lastAnswer?.role === 'assistant' && (
            <div>
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                You could also ask
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {chat.followUps.map((question) => (
                  <li key={question}>
                    <button
                      type="button"
                      onClick={() => void chat.send(question)}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-sm hover:border-primary"
                    >
                      {question}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {chat.error && (
            <FormAlert tone="error">
              <p>{chat.error.message}</p>
              <div className="mt-2 flex gap-3">
                {chat.error.retryable ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void chat.send(chat.error!.question)}
                  >
                    <RotateCcw aria-hidden /> Retry
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/pricing">See plans</Link>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={chat.dismissError}>
                  Dismiss
                </Button>
              </div>
            </FormAlert>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-border bg-background px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-2">
          <Composer
            onSend={(text) => void chat.send(text)}
            onStop={stop}
            busy={busy}
            disabled={quotaReached}
            restore={restore}
            placeholder={quotaReached ? 'You’ve reached this month’s limit.' : undefined}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Disclaimer />
            <UsageNote />
          </div>
        </div>
      </div>

      <SourceSheet citation={citation} onClose={() => setCitation(null)} />
    </div>
  )
}

function ConversationHeader({ conversation }: { conversation: ConversationSummary }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [renameOpen, setRenameOpen] = useState(false)
  const [title, setTitle] = useState(conversation.title)

  const refresh = (summary: ConversationSummary) => {
    queryClient.setQueryData(
      aiKeys.conversation(user?.id, conversation.id),
      (old: object | undefined) => (old ? { ...old, ...summary } : old),
    )
    void queryClient.invalidateQueries({ queryKey: aiKeys.allConversations(user?.id) })
  }

  const update = useMutation({
    mutationFn: (patch: { title?: string; domain?: GuidanceDomain }) =>
      api.updateConversation(conversation.id, patch),
    onSuccess: (summary) => {
      refresh(summary)
      setRenameOpen(false)
    },
  })

  const remove = useMutation({
    mutationFn: () => api.deleteConversation(conversation.id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: aiKeys.conversation(user?.id, conversation.id) })
      await queryClient.invalidateQueries({ queryKey: aiKeys.allConversations(user?.id) })
      await navigate('/app/guide', { replace: true })
    },
  })

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
      <h1 className="min-w-0 basis-full truncate font-display text-lg font-semibold text-ink sm:basis-0 sm:flex-1">
        {conversation.title}
      </h1>

      <label className="sr-only" htmlFor="conversation-domain">
        Focus area
      </label>
      <NativeSelect
        id="conversation-domain"
        value={conversation.domain}
        onChange={(event) => update.mutate({ domain: event.target.value as GuidanceDomain })}
        className="h-9 w-auto text-xs"
      >
        {guidanceDomains.map((value) => (
          <option key={value} value={value}>
            {domainLabels[value]}
          </option>
        ))}
      </NativeSelect>

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open)
          if (open) setTitle(conversation.title)
        }}
      >
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Rename conversation">
            <PencilLine aria-hidden />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Rename conversation</DialogTitle>
          <DialogDescription>Choose a title that helps you find it later.</DialogDescription>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (title.trim()) update.mutate({ title: title.trim() })
            }}
          >
            {update.isError && <FormAlert tone="error">{update.error.message}</FormAlert>}
            <FormField label="Title">
              <Input
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
              />
            </FormField>
            <div className="flex justify-end gap-3">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={!title.trim() || update.isPending}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Delete conversation">
            <Trash2 aria-hidden />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Delete this conversation?</DialogTitle>
          <DialogDescription>
            Its messages and sources will be permanently removed.
          </DialogDescription>
          {remove.isError && (
            <FormAlert tone="error" className="mt-4">
              {remove.error.message}
            </FormAlert>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              className="bg-danger hover:bg-danger/90"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
