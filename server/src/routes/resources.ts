import { resourceCreateSchema, resourceQuerySchema, resourceUpdateSchema } from '@everguide/shared'
import type { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.ts'
import { parse } from '../lib/validation.ts'
import { requireAuth, requireRole, userContext } from '../middleware/auth.ts'
import type { AuthService } from '../services/auth-service.ts'
import type { ResourcesService } from '../services/resources-service.ts'

const uuid = z.uuid()
function idParam(value: unknown): string {
  const parsed = uuid.safeParse(value)
  if (!parsed.success) throw new AppError(404, 'not_found', 'Resource not found.')
  return parsed.data
}
const slugParam = z.string().regex(/^[a-z0-9-]{3,120}$/)

/** Resource library: public browsing, saved resources, and admin content management. */
export function registerResourceRoutes(
  api: Router,
  auth: AuthService,
  resources: ResourcesService,
) {
  const authed = requireAuth(auth)

  // Public: anyone can browse published resources.
  api.get('/resources', async (req, res) => {
    res.json(await resources.list(parse(resourceQuerySchema, req.query)))
  })

  api.get('/resources/:slug', async (req, res) => {
    const slug = slugParam.safeParse(req.params.slug)
    if (!slug.success) throw new AppError(404, 'not_found', 'Resource not found.')
    res.json(await resources.getBySlug(slug.data))
  })

  // Saved resources (signed in). PUT saves and DELETE removes; both are idempotent.
  api.get('/me/saved-resources', authed, async (req, res) => {
    res.json(await resources.listSaved(userContext(req)))
  })
  for (const [method, saved] of [
    ['put', true],
    ['delete', false],
  ] as const) {
    api[method]('/resources/:id/save', authed, async (req, res) => {
      res.json(await resources.setSaved(userContext(req), idParam(req.params.id), saved))
    })
  }

  // Admins: content management. The role is checked in the database on every request.
  const adminOnly = [authed, requireRole(auth, 'admin')]
  api.get('/admin/resources', ...adminOnly, async (_req, res) => {
    res.json(await resources.adminList())
  })

  api.post('/admin/resources', ...adminOnly, async (req, res) => {
    const input = parse(resourceCreateSchema, req.body)
    res.status(201).json(await resources.create(userContext(req).userId, input, String(req.id)))
  })

  api.patch('/admin/resources/:id', ...adminOnly, async (req, res) => {
    const patch = parse(resourceUpdateSchema, req.body)
    res.json(
      await resources.update(
        userContext(req).userId,
        idParam(req.params.id),
        patch,
        String(req.id),
      ),
    )
  })

  // A signed ticket for one cover-image upload, made by the browser straight to Cloudinary.
  api.post('/admin/uploads/resource-image', ...adminOnly, (_req, res) => {
    res.json(resources.signImageUpload())
  })

  api.delete('/admin/resources/:id', ...adminOnly, async (req, res) => {
    await resources.remove(userContext(req).userId, idParam(req.params.id), String(req.id))
    res.status(204).end()
  })
}
