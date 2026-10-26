import type { ChatMessage, ConversationSummary } from '@everguide/shared'
import type { ChatModel, StreamPart } from '../../src/lib/gemini.ts'
import type { RetrievedChunk, Retriever } from '../../src/rag/retriever.ts'
import type { AiStore, NewCitation } from '../../src/services/ai-store.ts'

/** In-memory AiStore that behaves like the real one, including per-user isolation. */
export function createFakeStore(options: { monthlyUsed?: number } = {}) {
  const conversations: (ConversationSummary & { userId: string })[] = []
  const messages: (ChatMessage & { conversationId: string; userId: string })[] = []
  const citations: (NewCitation & { messageId: string })[] = []
  const usage: { id: string; userId: string; status: string; tokens?: number }[] = []
  let seq = 0
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`
  const own = (userId: string, conversationId: string) =>
    conversations.find((c) => c.id === conversationId && c.userId === userId)

  const store: AiStore = {
    async listConversations(ctx) {
      return conversations.filter((c) => c.userId === ctx.userId)
    },
    async createConversation(ctx, domain) {
      const c = {
        id: id(),
        title: 'New conversation',
        domain,
        lastMessageAt: new Date().toISOString(),
        userId: ctx.userId,
      }
      conversations.push(c)
      return c
    },
    async getConversation(ctx, conversationId) {
      return own(ctx.userId, conversationId) ?? null
    },
    async getMessages(ctx, conversationId) {
      return messages.filter((m) => m.conversationId === conversationId && m.userId === ctx.userId)
    },
    async updateConversation(ctx, conversationId, patch) {
      const c = own(ctx.userId, conversationId)
      if (!c) return null
      Object.assign(c, patch)
      return c
    },
    async deleteConversation(ctx, conversationId) {
      const index = conversations.findIndex(
        (c) => c.id === conversationId && c.userId === ctx.userId,
      )
      if (index === -1) return false
      conversations.splice(index, 1)
      return true
    },
    async recentTurns(ctx, conversationId, limit) {
      return messages
        .filter((m) => m.conversationId === conversationId && m.userId === ctx.userId)
        .slice(-limit)
        .map(({ role, content }) => ({ role, content }))
    },
    async insertMessage(m) {
      const message = {
        id: id(),
        role: m.role,
        content: m.content,
        createdAt: new Date().toISOString(),
        grounded: m.grounded ?? null,
        safetyFlag: m.safetyFlag ?? null,
        citations: [],
        feedback: null,
        conversationId: m.conversationId,
        userId: m.userId,
      }
      messages.push(message)
      return message
    },
    async deleteMessage(messageId) {
      const index = messages.findIndex((m) => m.id === messageId)
      if (index !== -1) messages.splice(index, 1)
    },
    async insertCitations(messageId, _userId, list) {
      citations.push(...list.map((c) => ({ ...c, messageId })))
    },
    async touchConversation(conversationId, title) {
      const c = conversations.find((x) => x.id === conversationId)
      if (c && title) c.title = title
      return new Date().toISOString()
    },
    async reserveUsage(userId, limit) {
      const used =
        (options.monthlyUsed ?? 0) +
        usage.filter((u) => u.userId === userId && u.status !== 'failed').length
      if (used >= limit) return { reservationId: null, used }
      const reservation = { id: id(), userId, status: 'reserved' }
      usage.push(reservation)
      return { reservationId: reservation.id, used: used + 1 }
    },
    async completeUsage(usageId, details) {
      const u = usage.find((x) => x.id === usageId)
      if (u)
        Object.assign(u, {
          status: 'completed',
          tokens: details.inputTokens + details.outputTokens,
        })
    },
    async failUsage(usageId) {
      const u = usage.find((x) => x.id === usageId)
      if (u) u.status = 'failed'
    },
    async countUsage(ctx) {
      return usage.filter((u) => u.userId === ctx.userId && u.status !== 'failed').length
    },
    async saveFeedback() {
      return true
    },
  }

  return { store, conversations, messages, citations, usage }
}

export function source(n: number, overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: `chunk-${n}`,
    documentId: `doc-${n}`,
    title: `Guide ${n}`,
    sourceName: 'EverGuide starter guide (AI-drafted, pending expert review)',
    sourceUrl: null,
    heading: `Section ${n}`,
    content: `Content of source ${n}.`,
    similarity: 0.7,
    ...overrides,
  }
}

export function fakeRetriever(results: RetrievedChunk[]): Retriever & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async search(question) {
      calls.push(question)
      return results
    },
  }
}

type ChatBehaviour = {
  parts?: string[]
  failAfter?: number
  hangUntilAborted?: boolean
  followUps?: string[] | Error
  /** What generateJson returns (structured outputs such as interview feedback). */
  json?: unknown
}

export function fakeChat(
  behaviour: ChatBehaviour = {},
): ChatModel & { calls: { prompt: string }[] } {
  const calls: { prompt: string }[] = []
  return {
    name: 'fake-model',
    calls,
    async *streamAnswer({ prompt, signal }): AsyncIterable<StreamPart> {
      calls.push({ prompt })
      if (behaviour.hangUntilAborted) {
        await new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason)),
        )
      }
      const parts = behaviour.parts ?? ['Start small [1].']
      for (const [index, text] of parts.entries()) {
        if (behaviour.failAfter !== undefined && index >= behaviour.failAfter)
          throw new Error('model connection reset')
        yield { type: 'text', text }
      }
      yield { type: 'usage', inputTokens: 100, outputTokens: 20 }
    },
    async generateJson() {
      return { data: behaviour.json ?? null, inputTokens: 50, outputTokens: 30 }
    },
    async suggestFollowUps() {
      if (behaviour.followUps instanceof Error) throw behaviour.followUps
      return behaviour.followUps ?? ['What should I learn first?']
    },
  }
}
