import type {
  AiUsage,
  ChatStreamEvent,
  ConversationDetail,
  ConversationSummary,
  ConversationUpdate,
  Feedback,
  GuidanceDomain,
} from '@everguide/shared'
import { AppError } from '../lib/errors.ts'
import { ModelBlockedError, type ChatModel } from '../lib/gemini.ts'
import { resolveCitations } from '../rag/citations.ts'
import { buildQuestionPrompt, buildSystemInstruction, titleFromQuestion } from '../rag/prompt.ts'
import type { Retriever } from '../rag/retriever.ts'
import { CRISIS_RESPONSE, detectCrisis } from '../rag/safety.ts'
import type { AiStore } from './ai-store.ts'
import type { UserContext } from './profile-service.ts'

export type Emit = (event: ChatStreamEvent) => void

/** A prepared chat turn: all checks that can fail with a normal HTTP error have passed. */
export type Turn = { run(emit: Emit, signal: AbortSignal): Promise<void> }

export interface AiGuideService {
  listConversations(ctx: UserContext, search?: string): Promise<ConversationSummary[]>
  createConversation(ctx: UserContext, domain: GuidanceDomain): Promise<ConversationSummary>
  getConversation(ctx: UserContext, id: string): Promise<ConversationDetail>
  updateConversation(
    ctx: UserContext,
    id: string,
    patch: ConversationUpdate,
  ): Promise<ConversationSummary>
  deleteConversation(ctx: UserContext, id: string): Promise<void>
  prepareTurn(ctx: UserContext, conversationId: string, content: string): Promise<Turn>
  saveFeedback(ctx: UserContext, messageId: string, feedback: Feedback): Promise<void>
  getUsage(ctx: UserContext): Promise<AiUsage>
}

export type AiGuideOptions = {
  /** The user's monthly allowance, from their plan. */
  monthlyLimitFor: (userId: string) => Promise<number>
  minSimilarity: number
  historyTurns?: number
  answerTimeoutMs?: number
  now?: () => Date
}

const DEFAULT_TITLE = 'New conversation'
const notFound = () => new AppError(404, 'not_found', 'Conversation not found.')

function monthWindow(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { start, end }
}

/** What the user sees when a turn fails. Internal details stay in the server logs. */
export function turnErrorMessage(error: unknown): { code: string; message: string } {
  if (error instanceof ModelBlockedError) {
    return {
      code: 'blocked',
      message: 'The AI Guide couldn’t answer that. Try rephrasing your question.',
    }
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return { code: 'timeout', message: 'The AI Guide took too long to answer. Please try again.' }
  }
  return { code: 'failed', message: 'The AI Guide couldn’t finish this answer. Please try again.' }
}

export function createAiGuideService(
  store: AiStore,
  retriever: Retriever,
  chat: ChatModel,
  options: AiGuideOptions,
): AiGuideService {
  const now = options.now ?? (() => new Date())
  const historyTurns = options.historyTurns ?? 8
  const answerTimeoutMs = options.answerTimeoutMs ?? 60_000

  async function getUsage(ctx: UserContext): Promise<AiUsage> {
    const { start, end } = monthWindow(now())
    const [used, limit] = await Promise.all([
      store.countUsage(ctx, start),
      options.monthlyLimitFor(ctx.userId),
    ])
    return {
      used,
      limit,
      periodEnd: end.toISOString(),
    }
  }

  return {
    listConversations: (ctx, search) => store.listConversations(ctx, search),
    createConversation: (ctx, domain) => store.createConversation(ctx, domain),

    async getConversation(ctx, id) {
      const conversation = await store.getConversation(ctx, id)
      if (!conversation) throw notFound()
      return { ...conversation, messages: await store.getMessages(ctx, id) }
    },

    async updateConversation(ctx, id, patch) {
      const updated = await store.updateConversation(ctx, id, patch)
      if (!updated) throw notFound()
      return updated
    },

    async deleteConversation(ctx, id) {
      if (!(await store.deleteConversation(ctx, id))) throw notFound()
    },

    async saveFeedback(ctx, messageId, feedback) {
      const saved = await store.saveFeedback(
        ctx,
        messageId,
        feedback.rating,
        feedback.comment || null,
      )
      if (!saved) throw new AppError(404, 'not_found', 'Answer not found.')
    },

    getUsage,

    async prepareTurn(ctx, conversationId, content) {
      const conversation = await store.getConversation(ctx, conversationId)
      if (!conversation) throw notFound()

      // Crisis messages get support information straight away: no model call, and
      // they never count against the user's allowance.
      const crisis = detectCrisis(content)
      let reservationId: string | null = null
      if (!crisis) {
        const limit = await options.monthlyLimitFor(ctx.userId)
        const reservation = await store.reserveUsage(ctx.userId, limit)
        if (!reservation.reservationId) {
          throw new AppError(
            429,
            'quota_exceeded',
            `You’ve used all ${limit} AI Guide answers for this month. Your allowance resets at the start of next month.`,
          )
        }
        reservationId = reservation.reservationId
      }

      return {
        async run(emit, signal) {
          const startedAt = Date.now()
          const created: string[] = []
          let answerText = ''
          try {
            // The user may already have left (e.g. pressed Stop while the allowance was
            // being reserved). Every cancellation goes through the catch below, which
            // refunds the allowance and removes anything stored.
            signal.throwIfAborted()
            const userMessage = await store.insertMessage({
              conversationId,
              userId: ctx.userId,
              role: 'user',
              content,
            })
            created.push(userMessage.id)
            const title =
              conversation.title === DEFAULT_TITLE ? titleFromQuestion(content) : undefined
            const lastMessageAt = await store.touchConversation(conversationId, title)
            emit({
              type: 'start',
              userMessage,
              conversation: { ...conversation, title: title ?? conversation.title, lastMessageAt },
            })

            if (crisis) {
              const message = await store.insertMessage({
                conversationId,
                userId: ctx.userId,
                role: 'assistant',
                content: CRISIS_RESPONSE,
                grounded: false,
                safetyFlag: 'crisis',
                metadata: { safety: 'crisis_screen' },
              })
              emit({ type: 'delta', text: CRISIS_RESPONSE })
              emit({ type: 'done', message, usage: await getUsage(ctx) })
              return
            }

            // History excludes the question just stored (it is sent with the sources).
            const history = (await store.recentTurns(ctx, conversationId, historyTurns + 1)).slice(
              0,
              -1,
            )
            const retrievalStartedAt = Date.now()
            const sources = await retriever.search(content)
            const retrievalMs = Date.now() - retrievalStartedAt
            // Searching isn't cancellable, so check before starting the (paid) generation.
            signal.throwIfAborted()
            const deadline = AbortSignal.any([signal, AbortSignal.timeout(answerTimeoutMs)])

            const generationStartedAt = Date.now()
            let firstTokenMs: number | null = null
            let raw = ''
            let tokens = { inputTokens: 0, outputTokens: 0 }
            for await (const part of chat.streamAnswer({
              system: buildSystemInstruction(conversation.domain),
              history,
              prompt: buildQuestionPrompt(content, sources),
              signal: deadline,
            })) {
              if (part.type === 'text') {
                firstTokenMs ??= Date.now() - generationStartedAt
                raw += part.text
                emit({ type: 'delta', text: part.text })
              } else {
                tokens = { inputTokens: part.inputTokens, outputTokens: part.outputTokens }
              }
            }
            if (!raw.trim()) throw new Error('The model returned an empty answer')
            const generationMs = Date.now() - generationStartedAt

            const { text, used } = resolveCitations(raw, sources.length)
            answerText = text
            const message = await store.insertMessage({
              conversationId,
              userId: ctx.userId,
              role: 'assistant',
              content: text,
              grounded: used.length > 0,
              model: chat.name,
              // Evaluation metrics only — no personal data.
              metadata: {
                retrieval: {
                  candidates: sources.length,
                  cited: used.length,
                  topSimilarity: sources[0]?.similarity ?? null,
                  threshold: options.minSimilarity,
                },
                // Where the time goes, for spotting slow searches or slow models.
                timings: {
                  retrievalMs,
                  firstTokenMs,
                  generationMs,
                  totalMs: Date.now() - startedAt,
                },
              },
            })
            created.push(message.id)

            const citations = [...used]
              .sort((a, b) => a - b)
              .flatMap((number) => {
                const source = sources[number - 1]
                return source
                  ? [
                      {
                        number,
                        title: source.title,
                        sourceName: source.sourceName,
                        sourceUrl: source.sourceUrl,
                        excerpt: source.content.slice(0, 1200),
                        similarity: source.similarity,
                        chunkId: source.chunkId,
                        documentId: source.documentId,
                      },
                    ]
                  : []
              })
            await store.insertCitations(message.id, ctx.userId, citations)
            if (reservationId)
              await store.completeUsage(reservationId, {
                messageId: message.id,
                model: chat.name,
                ...tokens,
              })

            emit({
              type: 'done',
              message: {
                ...message,
                citations: citations.map(({ chunkId: _chunk, documentId: _doc, ...c }) => c),
              },
              usage: await getUsage(ctx),
            })
          } catch (error) {
            // Undo the half-finished turn: refund the allowance and remove stored messages,
            // so retrying starts cleanly. Clean-up errors must not hide the original error.
            if (reservationId) await store.failUsage(reservationId).catch(() => {})
            for (const id of created.reverse()) await store.deleteMessage(id).catch(() => {})
            throw error
          }

          // The answer is saved. Follow-up suggestions are a nice-to-have: sent afterwards so
          // they never delay the answer, and failures are ignored.
          if (crisis || signal.aborted) return
          const questions = await chat
            .suggestFollowUps({
              question: content,
              answer: answerText,
              signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
            })
            .catch(() => [])
          if (questions.length > 0) emit({ type: 'followups', questions })
        },
      }
    },
  }
}
