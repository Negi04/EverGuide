import { z } from 'zod'

// ---------------------------------------------------------------------
// Money: stored and sent as integer paise (1 rupee = 100 paise)
// ---------------------------------------------------------------------

/** ₹100 crore: far above any personal budget, small enough to stay exact in JavaScript. */
export const MAX_PAISE = 100_000_000_000

const paise = z
  .number({ error: 'Enter an amount.' })
  .int('Use whole paise.')
  .min(0, 'Amounts can’t be negative.')
  .max(MAX_PAISE, 'That amount is too large.')

/**
 * Parse a rupee amount typed by a person ("1,50,000", "2500.5", "₹ 99") into paise.
 * Returns null for anything that isn't a plain, non-negative amount with at most
 * two decimal places. Works on the text, never via floating-point multiplication.
 */
export function parseRupees(input: string): number | null {
  const text = input.replace(/[₹,\s]/g, '')
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text)
  if (!match) return null
  const rupees = Number(match[1])
  const fraction = Number((match[2] ?? '').padEnd(2, '0'))
  const result = rupees * 100 + fraction
  return Number.isSafeInteger(result) && result <= MAX_PAISE ? result : null
}

/** Paise as a plain rupee string for an input field: 150050 → "1500.50", 150000 → "1500". */
export function paiseToInput(value: number): string {
  const rupees = Math.floor(value / 100)
  const rest = value % 100
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, '0')}`
}

// ---------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------

export const budgetKinds = ['need', 'want', 'saving'] as const
export type BudgetKind = (typeof budgetKinds)[number]

/** A month as YYYY-MM. */
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use a month like 2026-10.')

export const budgetIncomeSchema = z.object({ incomePaise: paise })

const itemLabel = z
  .string({ error: 'Name the item.' })
  .trim()
  .min(1, 'Name the item.')
  .max(80, 'Keep the name under 80 characters.')

export const budgetItemCreateSchema = z.object({
  label: itemLabel,
  kind: z.enum(budgetKinds),
  plannedPaise: paise.default(0),
  spentPaise: paise.default(0),
})

export const budgetItemUpdateSchema = z
  .object({ label: itemLabel, kind: z.enum(budgetKinds), plannedPaise: paise, spentPaise: paise })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

export type BudgetItemCreate = z.input<typeof budgetItemCreateSchema>
export type BudgetItemUpdate = z.infer<typeof budgetItemUpdateSchema>

export const MAX_BUDGET_ITEMS = 60

export type BudgetItem = {
  id: string
  label: string
  kind: BudgetKind
  plannedPaise: number
  spentPaise: number
}

/** `exists` is false for a month with no budget yet (income 0, no items). */
export type Budget = { month: string; exists: boolean; incomePaise: number; items: BudgetItem[] }

export type BudgetSummary = {
  planned: Record<BudgetKind, number>
  spent: Record<BudgetKind, number>
  totalPlanned: number
  totalSpent: number
  /** Income not yet given a job (negative when planned spending exceeds income). */
  unplanned: number
  /** The 50/30/20 rule of thumb applied to this income, for comparison only. */
  guideline: Record<BudgetKind, number>
}

const GUIDELINE_SHARE: Record<BudgetKind, number> = { need: 0.5, want: 0.3, saving: 0.2 }

export function budgetSummary(incomePaise: number, items: BudgetItem[]): BudgetSummary {
  const zero = (): Record<BudgetKind, number> => ({ need: 0, want: 0, saving: 0 })
  const planned = zero()
  const spent = zero()
  for (const item of items) {
    planned[item.kind] += item.plannedPaise
    spent[item.kind] += item.spentPaise
  }
  const totalPlanned = planned.need + planned.want + planned.saving
  const totalSpent = spent.need + spent.want + spent.saving
  const guideline = zero()
  for (const kind of budgetKinds) guideline[kind] = Math.round(incomePaise * GUIDELINE_SHARE[kind])
  return {
    planned,
    spent,
    totalPlanned,
    totalSpent,
    unplanned: incomePaise - totalPlanned,
    guideline,
  }
}

// ---------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------

const isoDate = z.iso.date({ error: 'Use a valid date.' })
const goalName = z
  .string({ error: 'Name the goal.' })
  .trim()
  .min(1, 'Name the goal.')
  .max(80, 'Keep the name under 80 characters.')
const targetPaise = paise.min(100, 'Set a target of at least ₹1.')

export const savingsGoalCreateSchema = z.object({
  name: goalName,
  targetPaise,
  targetDate: isoDate.nullable().optional(),
})

export const savingsGoalUpdateSchema = z
  .object({ name: goalName, targetPaise, targetDate: isoDate.nullable(), archived: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

/** Positive for a deposit, negative for a withdrawal. */
export const savingsEntrySchema = z.object({
  amountPaise: z
    .number({ error: 'Enter an amount.' })
    .int()
    .refine((v) => v !== 0, 'Enter an amount.')
    .refine((v) => Math.abs(v) <= MAX_PAISE, 'That amount is too large.'),
  note: z.string().trim().max(120).optional(),
  entryDate: isoDate.optional(),
})

export type SavingsGoalCreate = z.input<typeof savingsGoalCreateSchema>
export type SavingsGoalUpdate = z.infer<typeof savingsGoalUpdateSchema>
export type SavingsEntryInput = z.infer<typeof savingsEntrySchema>

export const MAX_SAVINGS_GOALS = 20

export type SavingsEntry = {
  id: string
  amountPaise: number
  note: string | null
  entryDate: string
  createdAt: string
}

export type SavingsGoal = {
  id: string
  name: string
  targetPaise: number
  targetDate: string | null
  archived: boolean
  createdAt: string
  /** Sum of all entries: the history always explains the number. */
  savedPaise: number
  /** Most recent entries, newest first. */
  entries: SavingsEntry[]
}

// ---------------------------------------------------------------------
// Educational calculators (rupees as numbers; results rounded for display)
// ---------------------------------------------------------------------

/**
 * Future value of a monthly SIP, assuming a fixed annual return compounded monthly and
 * each instalment invested at the start of the month (how most SIP calculators work).
 * Real returns vary and can be negative; this is an illustration, not a prediction.
 */
export function sipFutureValue(monthly: number, annualRatePercent: number, years: number) {
  const months = Math.round(years * 12)
  const i = annualRatePercent / 1200
  const invested = monthly * months
  const value = i === 0 ? invested : monthly * (((1 + i) ** months - 1) / i) * (1 + i)
  return { invested, value, gains: value - invested }
}

/** Equated monthly instalment for a loan, with the total paid and interest. */
export function loanEmi(principal: number, annualRatePercent: number, months: number) {
  const n = Math.round(months)
  const i = annualRatePercent / 1200
  const emi = i === 0 ? principal / n : (principal * i * (1 + i) ** n) / ((1 + i) ** n - 1)
  const totalPaid = emi * n
  return { emi, totalPaid, totalInterest: totalPaid - principal }
}

/** Compound interest: A = P(1 + r/n)^(n·t). */
export function compoundInterest(
  principal: number,
  annualRatePercent: number,
  years: number,
  timesPerYear: number,
) {
  const amount = principal * (1 + annualRatePercent / 100 / timesPerYear) ** (timesPerYear * years)
  return { amount, interest: amount - principal }
}
