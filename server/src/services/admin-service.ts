import type {
  AdminFeedback,
  AdminOverview,
  AdminUser,
  AppRole,
  AuditPage,
  KnowledgeDocumentSummary,
  KnowledgeStatus,
} from '@everguide/shared'
import { ZodError } from 'zod'
import { AppError, databaseError, serviceUnavailable } from '../lib/errors.ts'
import type { Embedder } from '../lib/gemini.ts'
import { fetchAllPages } from '../lib/paging.ts'
import type { Db } from '../lib/supabase.ts'
import { ingestDocument } from '../rag/ingest.ts'

export interface AdminService {
  overview(): Promise<AdminOverview>
  listUsers(q?: string): Promise<AdminUser[]>
  setAdmin(actorId: string, targetId: string, admin: boolean, requestId: string): Promise<AdminUser>
  listDocuments(): Promise<KnowledgeDocumentSummary[]>
  uploadDocument(
    actorId: string,
    markdown: string,
    requestId: string,
  ): Promise<KnowledgeDocumentSummary>
  setDocumentStatus(
    actorId: string,
    documentId: string,
    status: KnowledgeStatus,
    requestId: string,
  ): Promise<KnowledgeDocumentSummary>
  listFeedback(rating?: AdminFeedback['rating']): Promise<AdminFeedback[]>
  auditLog(query: { area?: string; offset: number }): Promise<AuditPage>
}

/** Users shown at once; search narrows it down. */
const USER_LIST_LIMIT = 200
/** Auth users read per page, and at most this many pages (keeps the admin page bounded). */
const AUTH_PAGE = 1000
const AUTH_MAX_PAGES = 10
const AUDIT_PAGE = 50
const FEEDBACK_LIMIT = 100
const IN_CHUNK = 100
const ANSWER_PREVIEW = 2000

const userNotFound = () => new AppError(404, 'not_found', 'User not found.')
const documentNotFound = () => new AppError(404, 'not_found', 'Document not found.')

/**
 * The admin portal. Routes check the admin role in the database before calling these;
 * the service-role client is then used for reads across users and for server-only
 * writes, and every change is written to the audit log. Nothing here reads journals.
 */
export function createAdminService(
  admin: Db,
  ai: { embedder: Embedder; embeddingModel: string } | null,
): AdminService {
  async function audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    requestId: string,
    metadata: Record<string, unknown> = {},
  ) {
    const { error } = await admin.from('audit_events').insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      request_id: requestId,
      metadata,
    })
    if (error) throw databaseError(error)
  }

  async function rolesFor(userIds?: string[]): Promise<Map<string, AppRole[]>> {
    let rows: { user_id: string; role: AppRole }[]
    try {
      rows = await fetchAllPages((from, to) => {
        let query = admin
          .from('user_roles')
          .select('user_id, role')
          .order('user_id')
          .range(from, to)
        if (userIds) query = query.in('user_id', userIds)
        return query
      })
    } catch (error) {
      throw databaseError(error)
    }
    const map = new Map<string, AppRole[]>()
    for (const row of rows) map.set(row.user_id, [...(map.get(row.user_id) ?? []), row.role])
    return map
  }

  async function namesFor(ids: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>()
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      const { data, error } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', ids.slice(i, i + IN_CHUNK))
      if (error) throw databaseError(error)
      for (const row of data) map.set(row.id, row.full_name)
    }
    return map
  }

  async function getUser(id: string): Promise<AdminUser> {
    const { data, error } = await admin.auth.admin.getUserById(id)
    if (error || !data.user) throw userNotFound()
    const [roles, names] = await Promise.all([rolesFor([id]), namesFor([id])])
    return {
      id,
      email: data.user.email ?? null,
      fullName: names.get(id) ?? null,
      roles: roles.get(id) ?? [],
      createdAt: data.user.created_at,
      lastSignInAt: data.user.last_sign_in_at ?? null,
    }
  }

  async function chunkCounts(): Promise<Map<string, number>> {
    let rows: { document_id: string }[]
    try {
      rows = await fetchAllPages((from, to) =>
        admin
          .from('knowledge_chunks')
          .select('document_id')
          .order('document_id')
          .order('chunk_index')
          .range(from, to),
      )
    } catch (error) {
      throw databaseError(error)
    }
    const counts = new Map<string, number>()
    for (const row of rows) counts.set(row.document_id, (counts.get(row.document_id) ?? 0) + 1)
    return counts
  }

  type DocumentRow = {
    id: string
    slug: string
    title: string
    domain: string
    source_name: string
    status: KnowledgeStatus
    updated_at: string
  }
  const DOCUMENT_COLUMNS = 'id, slug, title, domain, source_name, status, updated_at'
  const toDocument = (row: DocumentRow, chunks: number): KnowledgeDocumentSummary => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    domain: row.domain as KnowledgeDocumentSummary['domain'], // CHECK constraint
    sourceName: row.source_name,
    status: row.status,
    chunks,
    updatedAt: row.updated_at,
  })

  async function getDocument(id: string): Promise<KnowledgeDocumentSummary> {
    const { data, error } = await admin
      .from('knowledge_documents')
      .select(DOCUMENT_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw databaseError(error)
    if (!data) throw documentNotFound()
    const { count, error: countError } = await admin
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', id)
    if (countError) throw databaseError(countError)
    return toDocument(data, count ?? 0)
  }

  return {
    async overview() {
      const [counts, weeks] = await Promise.all([
        admin.rpc('admin_overview'),
        admin.rpc('admin_signups_by_week', { p_weeks: 12 }),
      ])
      if (counts.error) throw databaseError(counts.error)
      if (weeks.error) throw databaseError(weeks.error)
      return {
        ...(counts.data as Omit<AdminOverview, 'signupsByWeek'>),
        signupsByWeek: weeks.data.map((w) => ({
          weekStart: w.week_start,
          signups: Number(w.signups),
        })),
      }
    },

    async listUsers(q) {
      const users: {
        id: string
        email?: string
        created_at: string
        last_sign_in_at?: string | null
      }[] = []
      for (let page = 1; page <= AUTH_MAX_PAGES; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: AUTH_PAGE })
        if (error) throw databaseError(error)
        users.push(...data.users)
        if (data.users.length < AUTH_PAGE) break
      }
      const [roles, names] = await Promise.all([rolesFor(), namesFor(users.map((u) => u.id))])
      const needle = q?.trim().toLowerCase()
      return users
        .map((u): AdminUser => ({
          id: u.id,
          email: u.email ?? null,
          fullName: names.get(u.id) ?? null,
          roles: roles.get(u.id) ?? [],
          createdAt: u.created_at,
          lastSignInAt: u.last_sign_in_at ?? null,
        }))
        .filter(
          (u) =>
            !needle ||
            u.email?.toLowerCase().includes(needle) ||
            u.fullName?.toLowerCase().includes(needle),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, USER_LIST_LIMIT)
    },

    async setAdmin(actorId, targetId, makeAdmin, requestId) {
      // The SQL function re-checks that the actor is an admin, refuses self-removal and
      // serialises concurrent changes with a lock.
      const { error } = await admin.rpc('set_admin_role', {
        p_actor: actorId,
        p_target: targetId,
        p_grant: makeAdmin,
      })
      if (error) {
        if (error.code === '42501') throw new AppError(403, 'forbidden', error.message)
        if (error.code === 'P0001') throw new AppError(409, 'conflict', error.message)
        if (error.code === 'P0002') throw userNotFound()
        throw databaseError(error)
      }
      await audit(
        actorId,
        makeAdmin ? 'role.admin_granted' : 'role.admin_removed',
        'user',
        targetId,
        requestId,
      )
      return getUser(targetId)
    },

    async listDocuments() {
      const [documents, counts] = await Promise.all([
        admin.from('knowledge_documents').select(DOCUMENT_COLUMNS).order('title'),
        chunkCounts(),
      ])
      if (documents.error) throw databaseError(documents.error)
      return documents.data.map((row) => toDocument(row, counts.get(row.id) ?? 0))
    },

    async uploadDocument(actorId, markdown, requestId) {
      if (!ai) throw serviceUnavailable('The AI service isn’t set up, so documents can’t be added.')
      let result: Awaited<ReturnType<typeof ingestDocument>>
      try {
        // Uploads are always drafts: changed content is reviewed before answers use it.
        result = await ingestDocument(admin, ai.embedder, ai.embeddingModel, markdown, {
          status: 'draft',
        })
      } catch (error) {
        if (error instanceof ZodError) {
          const issue = error.issues[0]
          throw new AppError(
            400,
            'validation_failed',
            `Front matter: ${issue?.path.join('.') || 'value'}: ${issue?.message ?? 'invalid'}.`,
          )
        }
        if (error instanceof Error && /front matter|no text/i.test(error.message)) {
          throw new AppError(400, 'validation_failed', error.message)
        }
        const unavailable = serviceUnavailable(
          'The document couldn’t be processed. Please try again.',
        )
        unavailable.cause = error
        throw unavailable
      }
      await audit(actorId, 'knowledge.uploaded', 'knowledge_document', result.id, requestId, {
        slug: result.slug,
        chunks: result.chunks,
        unchanged: result.unchanged,
      })
      return getDocument(result.id)
    },

    async setDocumentStatus(actorId, documentId, status, requestId) {
      const { data, error } = await admin
        .from('knowledge_documents')
        .update({ status })
        .eq('id', documentId)
        .select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw documentNotFound()
      const action =
        status === 'approved'
          ? 'knowledge.approved'
          : status === 'archived'
            ? 'knowledge.archived'
            : 'knowledge.drafted'
      await audit(actorId, action, 'knowledge_document', documentId, requestId)
      return getDocument(documentId)
    },

    async listFeedback(rating) {
      let query = admin
        .from('ai_feedback')
        .select('id, rating, comment, created_at, message_id')
        .order('created_at', { ascending: false })
        .limit(FEEDBACK_LIMIT)
      if (rating) query = query.eq('rating', rating)
      const feedback = await query
      if (feedback.error) throw databaseError(feedback.error)

      const ids = [...new Set(feedback.data.map((f) => f.message_id))]
      const answers = new Map<string, { content: string; grounded: boolean | null }>()
      for (let i = 0; i < ids.length; i += IN_CHUNK) {
        // Only the assistant's answer: no user id, no conversation, no user question.
        const { data, error } = await admin
          .from('messages')
          .select('id, content, grounded')
          .eq('role', 'assistant')
          .in('id', ids.slice(i, i + IN_CHUNK))
        if (error) throw databaseError(error)
        for (const m of data) answers.set(m.id, { content: m.content, grounded: m.grounded })
      }
      return feedback.data.flatMap((f) => {
        const answer = answers.get(f.message_id)
        return answer
          ? [
              {
                id: f.id,
                rating: f.rating as AdminFeedback['rating'],
                comment: f.comment,
                createdAt: f.created_at,
                answer: answer.content.slice(0, ANSWER_PREVIEW),
                grounded: answer.grounded,
              },
            ]
          : []
      })
    },

    async auditLog({ area, offset }) {
      let query = admin
        .from('audit_events')
        .select('id, action, actor_id, target_type, target_id, metadata, created_at')
        .order('id', { ascending: false })
        // One extra row tells us whether there's another page.
        .range(offset, offset + AUDIT_PAGE)
      if (area) query = query.like('action', `${area}.%`)
      const { data, error } = await query
      if (error) throw databaseError(error)
      const rows = data.slice(0, AUDIT_PAGE)
      const actorIds = [...new Set(rows.flatMap((r) => (r.actor_id ? [r.actor_id] : [])))]
      const names = await namesFor(actorIds)
      return {
        entries: rows.map((r) => ({
          id: r.id,
          action: r.action,
          actorName: r.actor_id ? (names.get(r.actor_id) ?? 'Unnamed user') : null,
          targetType: r.target_type,
          targetId: r.target_id,
          metadata: (r.metadata ?? {}) as Record<string, unknown>,
          createdAt: r.created_at,
        })),
        nextOffset: data.length > AUDIT_PAGE ? offset + AUDIT_PAGE : null,
      }
    },
  }
}
