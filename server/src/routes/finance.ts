import {
  budgetIncomeSchema,
  budgetItemCreateSchema,
  budgetItemUpdateSchema,
  monthSchema,
  savingsEntrySchema,
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
} from '@everguide/shared'
import type { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.ts'
import { parse } from '../lib/validation.ts'
import { requireAuth, userContext } from '../middleware/auth.ts'
import type { AuthService } from '../services/auth-service.ts'
import type { FinanceService } from '../services/finance-service.ts'

const uuid = z.uuid()
function idParam(value: unknown, what: string): string {
  const parsed = uuid.safeParse(value)
  if (!parsed.success) throw new AppError(404, 'not_found', `${what} not found.`)
  return parsed.data
}
function monthParam(value: unknown): string {
  const parsed = monthSchema.safeParse(value)
  if (!parsed.success) throw new AppError(400, 'validation_failed', 'Use a month like 2026-10.')
  return parsed.data
}

/** Finance endpoints: monthly budgets and savings goals. Amounts are integer paise. */
export function registerFinanceRoutes(api: Router, auth: AuthService, finance: FinanceService) {
  const authed = requireAuth(auth)

  api.get('/budgets/:month', authed, async (req, res) => {
    res.json(await finance.getBudget(userContext(req), monthParam(req.params.month)))
  })

  api.put('/budgets/:month', authed, async (req, res) => {
    const { incomePaise } = parse(budgetIncomeSchema, req.body)
    res.json(await finance.setIncome(userContext(req), monthParam(req.params.month), incomePaise))
  })

  api.post('/budgets/:month/items', authed, async (req, res) => {
    const input = parse(budgetItemCreateSchema, req.body)
    res
      .status(201)
      .json(await finance.addItem(userContext(req), monthParam(req.params.month), input))
  })

  api.post('/budgets/:month/copy-previous', authed, async (req, res) => {
    res.json(await finance.copyPreviousMonth(userContext(req), monthParam(req.params.month)))
  })

  api.patch('/budget-items/:id', authed, async (req, res) => {
    const patch = parse(budgetItemUpdateSchema, req.body)
    res.json(await finance.updateItem(userContext(req), idParam(req.params.id, 'Item'), patch))
  })

  api.delete('/budget-items/:id', authed, async (req, res) => {
    res.json(await finance.deleteItem(userContext(req), idParam(req.params.id, 'Item')))
  })

  api.get('/savings-goals', authed, async (req, res) => {
    res.json(await finance.listGoals(userContext(req)))
  })

  api.post('/savings-goals', authed, async (req, res) => {
    const input = parse(savingsGoalCreateSchema, req.body)
    res.status(201).json(await finance.createGoal(userContext(req), input))
  })

  api.patch('/savings-goals/:id', authed, async (req, res) => {
    const patch = parse(savingsGoalUpdateSchema, req.body)
    res.json(await finance.updateGoal(userContext(req), idParam(req.params.id, 'Goal'), patch))
  })

  api.delete('/savings-goals/:id', authed, async (req, res) => {
    await finance.deleteGoal(userContext(req), idParam(req.params.id, 'Goal'))
    res.status(204).end()
  })

  api.post('/savings-goals/:id/entries', authed, async (req, res) => {
    const input = parse(savingsEntrySchema, req.body)
    res
      .status(201)
      .json(await finance.addEntry(userContext(req), idParam(req.params.id, 'Goal'), input))
  })

  api.delete('/savings-entries/:id', authed, async (req, res) => {
    res.json(await finance.deleteEntry(userContext(req), idParam(req.params.id, 'Entry')))
  })
}
