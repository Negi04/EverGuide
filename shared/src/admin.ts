import { z } from 'zod'
import type { AppRole, GuidanceDomain } from './profile.ts'

/** Counts only: no names, no content, nothing from journals. */
export type AdminOverview = {
  users: { total: number; newLast7Days: number; newLast30Days: number; onboarded: number }
  ai: {
    messagesThisMonth: number
    failedThisMonth: number
    helpfulFeedback: number
    notHelpfulFeedback: number
  }
  mentors: { verified: number; pending: number }
  bookings: Record<string, number>
  content: { publishedResources: number; approvedKnowledgeDocuments: number }
  signupsByWeek: { weekStart: string; signups: number }[]
}

export type AdminUser = {
  id: string
  email: string | null
  fullName: string | null
  roles: AppRole[]
  createdAt: string
  lastSignInAt: string | null
}

export const adminRoleChangeSchema = z.object({ admin: z.boolean() })

export const knowledgeStatuses = ['draft', 'approved', 'archived'] as const
export type KnowledgeStatus = (typeof knowledgeStatuses)[number]

export type KnowledgeDocumentSummary = {
  id: string
  slug: string
  title: string
  domain: GuidanceDomain
  sourceName: string
  status: KnowledgeStatus
  chunks: number
  updatedAt: string
}

/**
 * Markdown with front matter, as in database/knowledge/README.md. The API accepts
 * request bodies up to 100 KB, so documents stay well under that.
 */
export const knowledgeUploadSchema = z.object({
  markdown: z
    .string({ error: 'Choose a Markdown file.' })
    .min(20, 'The file is empty.')
    .max(80_000, 'Keep documents under 80,000 characters.'),
})

export const knowledgeStatusSchema = z.object({ status: z.enum(knowledgeStatuses) })

/** Feedback on AI answers. Deliberately no user identity and no user question. */
export type AdminFeedback = {
  id: string
  rating: 'helpful' | 'not_helpful'
  comment: string | null
  createdAt: string
  answer: string
  grounded: boolean | null
}

export type AuditEntry = {
  id: number
  action: string
  actorName: string | null
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type AuditPage = { entries: AuditEntry[]; nextOffset: number | null }

export const auditQuerySchema = z.object({
  area: z.enum(['mentor', 'resource', 'knowledge', 'role', 'account']).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})
export type AuditQuery = z.input<typeof auditQuerySchema>
