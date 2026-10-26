import {
  habitCreateSchema,
  habitUpdateSchema,
  journalEntryCreateSchema,
  journalEntryUpdateSchema,
  journalQuerySchema,
} from '@everguide/shared'
import type { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.ts'
import { parse } from '../lib/validation.ts'
import { requireAuth, userContext } from '../middleware/auth.ts'
import type { AuthService } from '../services/auth-service.ts'
import type { WellnessService } from '../services/wellness-service.ts'

const uuid = z.uuid()
function idParam(value: unknown, what: string): string {
  const parsed = uuid.safeParse(value)
  if (!parsed.success) throw new AppError(404, 'not_found', `${what} not found.`)
  return parsed.data
}
const isoDate = z.iso.date()

/** Wellness endpoints: the private journal and habit tracking. */
export function registerWellnessRoutes(api: Router, auth: AuthService, wellness: WellnessService) {
  const authed = requireAuth(auth)

  api.get('/journal', authed, async (req, res) => {
    res.json(await wellness.listJournal(userContext(req), parse(journalQuerySchema, req.query)))
  })

  api.post('/journal', authed, async (req, res) => {
    const input = parse(journalEntryCreateSchema, req.body)
    res.status(201).json(await wellness.createJournalEntry(userContext(req), input))
  })

  api.patch('/journal/:id', authed, async (req, res) => {
    const patch = parse(journalEntryUpdateSchema, req.body)
    res.json(
      await wellness.updateJournalEntry(userContext(req), idParam(req.params.id, 'Entry'), patch),
    )
  })

  api.delete('/journal/:id', authed, async (req, res) => {
    await wellness.deleteJournalEntry(userContext(req), idParam(req.params.id, 'Entry'))
    res.status(204).end()
  })

  api.get('/habits', authed, async (req, res) => {
    res.json(await wellness.listHabits(userContext(req)))
  })

  api.post('/habits', authed, async (req, res) => {
    res
      .status(201)
      .json(await wellness.createHabit(userContext(req), parse(habitCreateSchema, req.body)))
  })

  api.patch('/habits/:id', authed, async (req, res) => {
    const patch = parse(habitUpdateSchema, req.body)
    res.json(await wellness.updateHabit(userContext(req), idParam(req.params.id, 'Habit'), patch))
  })

  api.delete('/habits/:id', authed, async (req, res) => {
    await wellness.deleteHabit(userContext(req), idParam(req.params.id, 'Habit'))
    res.status(204).end()
  })

  // PUT marks a day done, DELETE un-marks it. Both are idempotent: repeating them is safe.
  for (const [method, done] of [
    ['put', true],
    ['delete', false],
  ] as const) {
    api[method]('/habits/:id/checkins/:date', authed, async (req, res) => {
      const date = isoDate.safeParse(req.params.date)
      if (!date.success) throw new AppError(400, 'validation_failed', 'Use a valid date.')
      res.json(
        await wellness.setCheckin(
          userContext(req),
          idParam(req.params.id, 'Habit'),
          date.data,
          done,
        ),
      )
    })
  }
}
