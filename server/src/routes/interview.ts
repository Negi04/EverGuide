import {
  interviewCategories,
  interviewRoles,
  practiceAttemptSchema,
  savedQuestionSchema,
} from '@everguide/shared'
import type { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.ts'
import { parse } from '../lib/validation.ts'
import { requireAuth, userContext } from '../middleware/auth.ts'
import { createRateLimiter } from '../middleware/rate-limit.ts'
import type { AuthService } from '../services/auth-service.ts'
import type { InterviewService } from '../services/interview-service.ts'

const uuid = z.uuid()
function idParam(value: unknown, what: string): string {
  const parsed = uuid.safeParse(value)
  if (!parsed.success) throw new AppError(404, 'not_found', `${what} not found.`)
  return parsed.data
}

const filtersSchema = z.object({
  role: z.enum(interviewRoles).optional(),
  category: z.enum(interviewCategories).optional(),
  saved: z.enum(['true', 'false']).optional(),
})

export function registerInterviewRoutes(
  api: Router,
  auth: AuthService,
  interview: InterviewService,
  feedbackLimit: { windowMs: number; limit: number },
) {
  const authed = requireAuth(auth)

  api.get('/interview/questions', authed, async (req, res) => {
    const filters = parse(filtersSchema, req.query)
    res.json(
      await interview.listQuestions(userContext(req), {
        role: filters.role,
        category: filters.category,
        savedOnly: filters.saved === 'true',
      }),
    )
  })

  api.get('/interview/questions/:id', authed, async (req, res) => {
    res.json(await interview.getQuestion(userContext(req), idParam(req.params.id, 'Question')))
  })

  api.put('/interview/questions/:id/saved', authed, async (req, res) => {
    const { saved } = parse(savedQuestionSchema, req.body)
    await interview.setSaved(userContext(req), idParam(req.params.id, 'Question'), saved)
    res.status(204).end()
  })

  // AI feedback costs money, so this shares the per-IP limit used for AI answers.
  api.post(
    '/interview/questions/:id/attempts',
    createRateLimiter(feedbackLimit),
    authed,
    async (req, res) => {
      const input = parse(practiceAttemptSchema, req.body)
      res
        .status(201)
        .json(
          await interview.createAttempt(
            userContext(req),
            idParam(req.params.id, 'Question'),
            input,
          ),
        )
    },
  )

  api.delete('/interview/attempts/:id', authed, async (req, res) => {
    await interview.deleteAttempt(userContext(req), idParam(req.params.id, 'Practice answer'))
    res.status(204).end()
  })
}
