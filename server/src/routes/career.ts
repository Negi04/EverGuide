import {
  goalCreateSchema,
  goalUpdateSchema,
  milestoneCreateSchema,
  milestoneUpdateSchema,
} from '@everguide/shared'
import type { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.ts'
import { parse } from '../lib/validation.ts'
import { requireAuth, userContext } from '../middleware/auth.ts'
import type { AuthService } from '../services/auth-service.ts'
import type { CareerService } from '../services/career-service.ts'

const uuid = z.uuid()
function idParam(value: unknown, what: string): string {
  const parsed = uuid.safeParse(value)
  if (!parsed.success) throw new AppError(404, 'not_found', `${what} not found.`)
  return parsed.data
}

/** Career roadmap endpoints: goals and their milestones. */
export function registerCareerRoutes(api: Router, auth: AuthService, career: CareerService) {
  const authed = requireAuth(auth)

  api.get('/goals', authed, async (req, res) => {
    res.json(await career.listGoals(userContext(req)))
  })

  api.post('/goals', authed, async (req, res) => {
    res
      .status(201)
      .json(await career.createGoal(userContext(req), parse(goalCreateSchema, req.body)))
  })

  api.patch('/goals/:id', authed, async (req, res) => {
    const patch = parse(goalUpdateSchema, req.body)
    res.json(await career.updateGoal(userContext(req), idParam(req.params.id, 'Goal'), patch))
  })

  api.delete('/goals/:id', authed, async (req, res) => {
    await career.deleteGoal(userContext(req), idParam(req.params.id, 'Goal'))
    res.status(204).end()
  })

  api.get('/goals/:id/recommendations', authed, async (req, res) => {
    res.json(await career.recommendations(userContext(req), idParam(req.params.id, 'Goal')))
  })

  api.post('/goals/:id/milestones', authed, async (req, res) => {
    const input = parse(milestoneCreateSchema, req.body)
    res
      .status(201)
      .json(await career.addMilestone(userContext(req), idParam(req.params.id, 'Goal'), input))
  })

  api.patch('/milestones/:id', authed, async (req, res) => {
    const patch = parse(milestoneUpdateSchema, req.body)
    res.json(
      await career.updateMilestone(userContext(req), idParam(req.params.id, 'Milestone'), patch),
    )
  })

  api.delete('/milestones/:id', authed, async (req, res) => {
    res.json(await career.deleteMilestone(userContext(req), idParam(req.params.id, 'Milestone')))
  })
}
