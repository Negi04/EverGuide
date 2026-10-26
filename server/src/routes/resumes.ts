import { resumeAnalysisRequestSchema } from '@everguide/shared'
import express, { type Router } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.ts'
import { parse } from '../lib/validation.ts'
import { requireAuth, userContext } from '../middleware/auth.ts'
import { createRateLimiter } from '../middleware/rate-limit.ts'
import type { AuthService } from '../services/auth-service.ts'
import type { ResumeService } from '../services/resume-service.ts'

const uuid = z.uuid()
function idParam(value: unknown): string {
  const parsed = uuid.safeParse(value)
  if (!parsed.success) throw new AppError(404, 'not_found', 'Resume not found.')
  return parsed.data
}

export function registerResumeRoutes(
  api: Router,
  auth: AuthService,
  resumes: ResumeService,
  limits: {
    upload: { windowMs: number; limit: number }
    analysis: { windowMs: number; limit: number }
  },
) {
  const authed = requireAuth(auth)

  api.get('/resumes', authed, async (req, res) => {
    res.json(await resumes.list(userContext(req)))
  })

  api.get('/resumes/:id', authed, async (req, res) => {
    res.json(await resumes.get(userContext(req), idParam(req.params.id)))
  })

  // The PDF is sent as the raw request body. Authentication runs first, so anonymous
  // callers can't make the server buffer a 5 MB upload.
  api.post(
    '/resumes',
    createRateLimiter(limits.upload),
    authed,
    express.raw({ type: 'application/pdf', limit: '5mb' }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body)) {
        throw new AppError(
          400,
          'validation_failed',
          'Upload a PDF file (Content-Type: application/pdf).',
        )
      }
      const resume = await resumes.upload(userContext(req), {
        name: req.get('x-file-name'),
        data: req.body,
      })
      res.status(201).json(resume)
    },
  )

  api.delete('/resumes/:id', authed, async (req, res) => {
    await resumes.remove(userContext(req), idParam(req.params.id))
    res.status(204).end()
  })

  api.post(
    '/resumes/:id/analyses',
    createRateLimiter(limits.analysis),
    authed,
    async (req, res) => {
      const input = parse(resumeAnalysisRequestSchema, req.body ?? {})
      res.status(201).json(await resumes.analyse(userContext(req), idParam(req.params.id), input))
    },
  )
}
