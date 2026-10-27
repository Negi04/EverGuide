import {
  adminRoleChangeSchema,
  auditQuerySchema,
  knowledgeStatusSchema,
  knowledgeUploadSchema,
} from '@everguide/shared'
import type { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.ts'
import { parse } from '../lib/validation.ts'
import { requireAuth, requireRole, userContext } from '../middleware/auth.ts'
import type { AdminService } from '../services/admin-service.ts'
import type { AuthService } from '../services/auth-service.ts'

const uuid = z.uuid()
function idParam(value: unknown, what: string): string {
  const parsed = uuid.safeParse(value)
  if (!parsed.success) throw new AppError(404, 'not_found', `${what} not found.`)
  return parsed.data
}
const userSearch = z.object({ q: z.string().trim().max(100).optional() })
const feedbackQuery = z.object({ rating: z.enum(['helpful', 'not_helpful']).optional() })

/** Admin portal. Every route checks the admin role in the database first. */
export function registerAdminRoutes(api: Router, auth: AuthService, admin: AdminService) {
  const adminOnly = [requireAuth(auth), requireRole(auth, 'admin')]

  api.get('/admin/overview', ...adminOnly, async (_req, res) => {
    res.json(await admin.overview())
  })

  api.get('/admin/users', ...adminOnly, async (req, res) => {
    res.json(await admin.listUsers(parse(userSearch, req.query).q))
  })

  api.post('/admin/users/:id/admin-role', ...adminOnly, async (req, res) => {
    const { admin: makeAdmin } = parse(adminRoleChangeSchema, req.body)
    res.json(
      await admin.setAdmin(
        userContext(req).userId,
        idParam(req.params.id, 'User'),
        makeAdmin,
        String(req.id),
      ),
    )
  })

  api.get('/admin/knowledge-documents', ...adminOnly, async (_req, res) => {
    res.json(await admin.listDocuments())
  })

  api.post('/admin/knowledge-documents', ...adminOnly, async (req, res) => {
    const { markdown } = parse(knowledgeUploadSchema, req.body)
    res
      .status(201)
      .json(await admin.uploadDocument(userContext(req).userId, markdown, String(req.id)))
  })

  api.patch('/admin/knowledge-documents/:id', ...adminOnly, async (req, res) => {
    const { status } = parse(knowledgeStatusSchema, req.body)
    res.json(
      await admin.setDocumentStatus(
        userContext(req).userId,
        idParam(req.params.id, 'Document'),
        status,
        String(req.id),
      ),
    )
  })

  api.get('/admin/ai-feedback', ...adminOnly, async (req, res) => {
    res.json(await admin.listFeedback(parse(feedbackQuery, req.query).rating))
  })

  api.get('/admin/audit-events', ...adminOnly, async (req, res) => {
    res.json(await admin.auditLog(parse(auditQuerySchema, req.query)))
  })
}
