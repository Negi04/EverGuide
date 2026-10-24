import type {
  ChatMessage,
  Citation,
  ConversationSummary,
  ConversationUpdate,
  FeedbackRating,
  GuidanceDomain,
} from '@everguide/shared'
import { serviceUnavailable } from '../lib/errors.ts'
import type { Db } from '../lib/supabase.ts'
import type { UserContext } from './profile-service.ts'

export type NewMessage = {
  conversationId: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  grounded?: boolean | null
  safetyFlag?: 'crisis' | null
  model?: string | null
  metadata?: Record<string, unknown>
}

export type NewCitation = Omit<Citation, 'similarity'> & {
  similarity: number
  chunkId: string | null
  documentId: string | null
}

/**
 * All AI Guide database access. Reads and conversation edits run as the user (RLS
 * applies); messages, citations and usage are written with the service role, because
 * users must not be able to forge them.
 */
export interface AiStore {
  listConversations(ctx: UserContext, search?: string): Promise<ConversationSummary[]>
  createConversation(ctx: UserContext, domain: GuidanceDomain): Promise<ConversationSummary>
  getConversation(ctx: UserContext, id: string): Promise<ConversationSummary | null>
  getMessages(ctx: UserContext, conversationId: string): Promise<ChatMessage[]>
  updateConversation(
    ctx: UserContext,
    id: string,
    patch: ConversationUpdate,
  ): Promise<ConversationSummary | null>
  deleteConversation(ctx: UserContext, id: string): Promise<boolean>
  recentTurns(
    ctx: UserContext,
    conversationId: string,
    limit: number,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]>
  insertMessage(message: NewMessage): Promise<ChatMessage>
  deleteMessage(id: string): Promise<void>
  insertCitations(messageId: string, userId: string, citations: NewCitation[]): Promise<void>
  touchConversation(id: string, title?: string): Promise<string>
  reserveUsage(
    userId: string,
    monthlyLimit: number,
  ): Promise<{ reservationId: string | null; used: number }>
  completeUsage(
    id: string,
    details: { messageId: string; model: string; inputTokens: number; outputTokens: number },
  ): Promise<void>
  failUsage(id: string): Promise<void>
  countUsage(ctx: UserContext, since: Date): Promise<number>
  /** Returns false when the message doesn't exist, isn't the user's, or isn't an AI answer. */
  saveFeedback(
    ctx: UserContext,
    messageId: string,
    rating: FeedbackRating,
    comment: string | null,
  ): Promise<boolean>
}

type ConversationRow = { id: string; title: string; domain: string; last_message_at: string }
const CONVERSATION_COLUMNS = 'id, title, domain, last_message_at'

const toSummary = (row: ConversationRow): ConversationSummary => ({
  id: row.id,
  title: row.title,
  // The database CHECK constraint guarantees a valid domain.
  domain: row.domain as GuidanceDomain,
  lastMessageAt: row.last_message_at,
})

/** Escape LIKE wildcards so a search for "50%" means the literal text. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Hide database details from the client, but keep them on `cause` for the server logs. */
function fail(error: unknown): never {
  const appError = serviceUnavailable()
  appError.cause = error
  throw appError
}

export function createAiStore(admin: Db, clientFor: (accessToken: string) => Db): AiStore {
  return {
    async listConversations(ctx, search) {
      let query = clientFor(ctx.accessToken)
        .from('conversations')
        .select(CONVERSATION_COLUMNS)
        .order('last_message_at', { ascending: false })
        .limit(100)
      if (search) query = query.ilike('title', `%${escapeLike(search)}%`)
      const { data, error } = await query
      if (error) fail(error)
      return data.map(toSummary)
    },

    async createConversation(ctx, domain) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('conversations')
        .insert({ user_id: ctx.userId, domain })
        .select(CONVERSATION_COLUMNS)
        .single()
      if (error) fail(error)
      return toSummary(data)
    },

    async getConversation(ctx, id) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('conversations')
        .select(CONVERSATION_COLUMNS)
        .eq('id', id)
        .maybeSingle()
      if (error) fail(error)
      return data ? toSummary(data) : null
    },

    async getMessages(ctx, conversationId) {
      const db = clientFor(ctx.accessToken)
      const messages = await db
        .from('messages')
        .select('id, role, content, grounded, safety_flag, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(500)
      if (messages.error) fail(messages.error)
      const ids = messages.data.map((m) => m.id)
      if (ids.length === 0) return []

      const [citations, feedback] = await Promise.all([
        db
          .from('message_citations')
          .select(
            'message_id, citation_number, title, source_name, source_url, excerpt, similarity',
          )
          .in('message_id', ids)
          .order('citation_number', { ascending: true }),
        db.from('ai_feedback').select('message_id, rating').in('message_id', ids),
      ])
      if (citations.error) fail(citations.error)
      if (feedback.error) fail(feedback.error)

      return messages.data.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        grounded: m.grounded,
        safetyFlag: m.safety_flag,
        citations: citations.data
          .filter((c) => c.message_id === m.id)
          .map((c) => ({
            number: c.citation_number,
            title: c.title,
            sourceName: c.source_name,
            sourceUrl: c.source_url,
            excerpt: c.excerpt,
            similarity: c.similarity,
          })),
        feedback: feedback.data.find((f) => f.message_id === m.id)?.rating ?? null,
      }))
    },

    async updateConversation(ctx, id, patch) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('conversations')
        .update({ title: patch.title, domain: patch.domain })
        .eq('id', id)
        .select(CONVERSATION_COLUMNS)
        .maybeSingle()
      if (error) fail(error)
      return data ? toSummary(data) : null
    },

    async deleteConversation(ctx, id) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('conversations')
        .delete()
        .eq('id', id)
        .select('id')
      if (error) fail(error)
      return data.length > 0
    },

    async recentTurns(ctx, conversationId, limit) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) fail(error)
      return data.reverse()
    },

    async insertMessage(message) {
      const { data, error } = await admin
        .from('messages')
        .insert({
          conversation_id: message.conversationId,
          user_id: message.userId,
          role: message.role,
          content: message.content,
          grounded: message.grounded ?? null,
          safety_flag: message.safetyFlag ?? null,
          model: message.model ?? null,
          metadata: message.metadata ?? {},
        })
        .select('id, role, content, grounded, safety_flag, created_at')
        .single()
      if (error) fail(error)
      return {
        id: data.id,
        role: data.role,
        content: data.content,
        createdAt: data.created_at,
        grounded: data.grounded,
        safetyFlag: data.safety_flag,
        citations: [],
        feedback: null,
      }
    },

    async deleteMessage(id) {
      const { error } = await admin.from('messages').delete().eq('id', id)
      if (error) fail(error)
    },

    async insertCitations(messageId, userId, citations) {
      if (citations.length === 0) return
      const { error } = await admin.from('message_citations').insert(
        citations.map((c) => ({
          message_id: messageId,
          user_id: userId,
          citation_number: c.number,
          chunk_id: c.chunkId,
          document_id: c.documentId,
          title: c.title,
          source_name: c.sourceName,
          source_url: c.sourceUrl,
          excerpt: c.excerpt,
          similarity: c.similarity,
        })),
      )
      if (error) fail(error)
    },

    async touchConversation(id, title) {
      const lastMessageAt = new Date().toISOString()
      const { error } = await admin
        .from('conversations')
        .update({ last_message_at: lastMessageAt, ...(title && { title }) })
        .eq('id', id)
      if (error) fail(error)
      return lastMessageAt
    },

    async reserveUsage(userId, monthlyLimit) {
      const { data, error } = await admin.rpc('reserve_ai_message', {
        p_user_id: userId,
        p_monthly_limit: monthlyLimit,
      })
      if (error) fail(error)
      const row = data[0]
      return { reservationId: row?.reservation_id ?? null, used: row?.used ?? 0 }
    },

    async completeUsage(id, details) {
      const { error } = await admin
        .from('ai_usage')
        .update({
          status: 'completed',
          message_id: details.messageId,
          model: details.model,
          input_tokens: details.inputTokens,
          output_tokens: details.outputTokens,
        })
        .eq('id', id)
      if (error) fail(error)
    },

    async failUsage(id) {
      const { error } = await admin.from('ai_usage').update({ status: 'failed' }).eq('id', id)
      if (error) fail(error)
    },

    async countUsage(ctx, since) {
      const { count, error } = await clientFor(ctx.accessToken)
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'failed')
        .gte('created_at', since.toISOString())
      if (error) fail(error)
      return count ?? 0
    },

    async saveFeedback(ctx, messageId, rating, comment) {
      const db = clientFor(ctx.accessToken)
      // Insert first; RLS only allows rating AI answers in the user's own conversations.
      const inserted = await db
        .from('ai_feedback')
        .insert({ message_id: messageId, user_id: ctx.userId, rating, comment })
      if (!inserted.error) return true
      if (inserted.error.code === '23505') {
        // Already rated: change the rating instead.
        const updated = await db
          .from('ai_feedback')
          .update({ rating, comment })
          .eq('message_id', messageId)
          .eq('user_id', ctx.userId)
          .select('id')
        if (updated.error) fail(updated.error)
        return updated.data.length > 0
      }
      // RLS refusal (42501) or a message that doesn't exist (23503).
      if (inserted.error.code === '42501' || inserted.error.code === '23503') return false
      fail(inserted.error)
    },
  }
}
