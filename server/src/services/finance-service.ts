import {
  MAX_BUDGET_ITEMS,
  MAX_SAVINGS_GOALS,
  type Budget,
  type BudgetItem,
  type BudgetItemCreate,
  type BudgetItemUpdate,
  type SavingsEntryInput,
  type SavingsGoal,
  type SavingsGoalCreate,
  type SavingsGoalUpdate,
} from '@everguide/shared'
import { AppError, databaseError } from '../lib/errors.ts'
import { fetchAllPages } from '../lib/paging.ts'
import type { Db } from '../lib/supabase.ts'
import type { UserContext } from './profile-service.ts'

export interface FinanceService {
  getBudget(ctx: UserContext, month: string): Promise<Budget>
  setIncome(ctx: UserContext, month: string, incomePaise: number): Promise<Budget>
  addItem(ctx: UserContext, month: string, input: BudgetItemCreate): Promise<Budget>
  updateItem(ctx: UserContext, itemId: string, patch: BudgetItemUpdate): Promise<Budget>
  deleteItem(ctx: UserContext, itemId: string): Promise<Budget>
  copyPreviousMonth(ctx: UserContext, month: string): Promise<Budget>
  listGoals(ctx: UserContext): Promise<SavingsGoal[]>
  createGoal(ctx: UserContext, input: SavingsGoalCreate): Promise<SavingsGoal>
  updateGoal(ctx: UserContext, goalId: string, patch: SavingsGoalUpdate): Promise<SavingsGoal>
  deleteGoal(ctx: UserContext, goalId: string): Promise<void>
  addEntry(ctx: UserContext, goalId: string, input: SavingsEntryInput): Promise<SavingsGoal>
  deleteEntry(ctx: UserContext, entryId: string): Promise<SavingsGoal>
}

const ITEM_COLUMNS = 'id, budget_id, label, kind, planned_paise, spent_paise, position'
const GOAL_COLUMNS = 'id, name, target_paise, target_date, archived_at, created_at'
const ENTRY_COLUMNS = 'id, goal_id, amount_paise, note, entry_date, created_at'
/** Entries shown per goal; the balance always uses every entry. */
const RECENT_ENTRIES = 10

const itemNotFound = () => new AppError(404, 'not_found', 'Budget item not found.')
const goalNotFound = () => new AppError(404, 'not_found', 'Savings goal not found.')
const entryNotFound = () => new AppError(404, 'not_found', 'Entry not found.')

/** '2026-10' → '2026-10-01' (budgets are stored by their first day). */
const monthDate = (month: string) => `${month}-01`
function previousMonth(month: string): string {
  const [year, m] = month.split('-').map(Number) as [number, number]
  return m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, '0')}`
}

type ItemRow = {
  id: string
  budget_id: string
  label: string
  kind: BudgetItem['kind']
  planned_paise: number
  spent_paise: number
  position: number
}
type GoalRow = {
  id: string
  name: string
  target_paise: number
  target_date: string | null
  archived_at: string | null
  created_at: string
}
type EntryRow = {
  id: string
  goal_id: string
  amount_paise: number
  note: string | null
  entry_date: string
  created_at: string
}

const toItem = (row: ItemRow): BudgetItem => ({
  id: row.id,
  label: row.label,
  kind: row.kind,
  plannedPaise: row.planned_paise,
  spentPaise: row.spent_paise,
})

/** Map rule errors raised by record_savings_entry to API errors. */
function savingsRuleError(error: { code?: string; message: string }): AppError {
  if (error.code === 'P0001') return new AppError(409, 'conflict', error.message)
  if (error.code === 'P0002') return goalNotFound()
  return databaseError(error)
}

/**
 * Monthly budgets and savings goals. Everything runs as the signed-in user, so RLS and
 * the composite foreign keys keep each person's money data private. Amounts are paise.
 */
export function createFinanceService(clientFor: (accessToken: string) => Db): FinanceService {
  async function loadBudget(db: Db, month: string): Promise<Budget> {
    const budget = await db
      .from('budgets')
      .select('id, income_paise')
      .eq('month', monthDate(month))
      .maybeSingle()
    if (budget.error) throw databaseError(budget.error)
    if (!budget.data) return { month, exists: false, incomePaise: 0, items: [] }
    const items = await db
      .from('budget_items')
      .select(ITEM_COLUMNS)
      .eq('budget_id', budget.data.id)
      .order('position')
      .order('created_at')
    if (items.error) throw databaseError(items.error)
    return {
      month,
      exists: true,
      incomePaise: budget.data.income_paise,
      items: items.data.map(toItem),
    }
  }

  /** The budget's id, creating an empty budget for the month if there isn't one. */
  async function ensureBudget(db: Db, ctx: UserContext, month: string): Promise<string> {
    const created = await db
      .from('budgets')
      .upsert(
        { user_id: ctx.userId, month: monthDate(month) },
        { onConflict: 'user_id,month', ignoreDuplicates: true },
      )
    if (created.error) throw databaseError(created.error)
    const found = await db.from('budgets').select('id').eq('month', monthDate(month)).single()
    if (found.error) throw databaseError(found.error)
    return found.data.id
  }

  /** Month of the budget an item belongs to, as YYYY-MM (and proof the item is yours). */
  async function itemMonth(db: Db, itemId: string): Promise<string> {
    const item = await db.from('budget_items').select('budget_id').eq('id', itemId).maybeSingle()
    if (item.error) throw databaseError(item.error)
    if (!item.data) throw itemNotFound()
    const budget = await db.from('budgets').select('month').eq('id', item.data.budget_id).single()
    if (budget.error) throw databaseError(budget.error)
    return budget.data.month.slice(0, 7)
  }

  async function loadGoals(db: Db, goalId?: string): Promise<SavingsGoal[]> {
    let query = db.from('savings_goals').select(GOAL_COLUMNS).order('created_at').limit(100)
    if (goalId) query = query.eq('id', goalId)
    const goals = await query
    if (goals.error) throw databaseError(goals.error)
    if (goals.data.length === 0) return []
    let entries: EntryRow[]
    try {
      entries = await fetchAllPages<EntryRow>((from, to) =>
        db
          .from('savings_entries')
          .select(ENTRY_COLUMNS)
          .in(
            'goal_id',
            goals.data.map((g: GoalRow) => g.id),
          )
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, to),
      )
    } catch (error) {
      throw databaseError(error)
    }
    return goals.data.map((g: GoalRow): SavingsGoal => {
      const own = entries.filter((e) => e.goal_id === g.id)
      return {
        id: g.id,
        name: g.name,
        targetPaise: g.target_paise,
        targetDate: g.target_date,
        archived: g.archived_at !== null,
        createdAt: g.created_at,
        savedPaise: own.reduce((sum, e) => sum + e.amount_paise, 0),
        entries: own.slice(0, RECENT_ENTRIES).map((e) => ({
          id: e.id,
          amountPaise: e.amount_paise,
          note: e.note,
          entryDate: e.entry_date,
          createdAt: e.created_at,
        })),
      }
    })
  }

  async function getGoal(db: Db, goalId: string): Promise<SavingsGoal> {
    const [goal] = await loadGoals(db, goalId)
    if (!goal) throw goalNotFound()
    return goal
  }

  return {
    getBudget: (ctx, month) => loadBudget(clientFor(ctx.accessToken), month),

    async setIncome(ctx, month, incomePaise) {
      const db = clientFor(ctx.accessToken)
      // Not a single upsert: INSERT ... ON CONFLICT DO UPDATE needs UPDATE permission on
      // every column it writes (user_id, month), and users may only update income_paise.
      const budgetId = await ensureBudget(db, ctx, month)
      const { error } = await db
        .from('budgets')
        .update({ income_paise: incomePaise })
        .eq('id', budgetId)
      if (error) throw databaseError(error)
      return loadBudget(db, month)
    },

    async addItem(ctx, month, input) {
      const db = clientFor(ctx.accessToken)
      const budgetId = await ensureBudget(db, ctx, month)
      const count = await db
        .from('budget_items')
        .select('id', { count: 'exact', head: true })
        .eq('budget_id', budgetId)
      if (count.error) throw databaseError(count.error)
      if ((count.count ?? 0) >= MAX_BUDGET_ITEMS) {
        throw new AppError(409, 'conflict', `A budget can have up to ${MAX_BUDGET_ITEMS} items.`)
      }
      const { error } = await db.from('budget_items').insert({
        budget_id: budgetId,
        user_id: ctx.userId,
        label: input.label,
        kind: input.kind,
        planned_paise: input.plannedPaise ?? 0,
        spent_paise: input.spentPaise ?? 0,
        position: count.count ?? 0,
      })
      if (error) throw databaseError(error)
      return loadBudget(db, month)
    },

    async updateItem(ctx, itemId, patch) {
      const db = clientFor(ctx.accessToken)
      const month = await itemMonth(db, itemId)
      const { data, error } = await db
        .from('budget_items')
        .update({
          label: patch.label,
          kind: patch.kind,
          planned_paise: patch.plannedPaise,
          spent_paise: patch.spentPaise,
        })
        .eq('id', itemId)
        .select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw itemNotFound()
      return loadBudget(db, month)
    },

    async deleteItem(ctx, itemId) {
      const db = clientFor(ctx.accessToken)
      const month = await itemMonth(db, itemId)
      const { data, error } = await db.from('budget_items').delete().eq('id', itemId).select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw itemNotFound()
      return loadBudget(db, month)
    },

    async copyPreviousMonth(ctx, month) {
      const db = clientFor(ctx.accessToken)
      const current = await loadBudget(db, month)
      if (current.items.length > 0) {
        throw new AppError(409, 'conflict', 'This month already has items.')
      }
      const previous = await loadBudget(db, previousMonth(month))
      if (!previous.exists) {
        throw new AppError(404, 'not_found', 'There’s no budget for the previous month.')
      }
      const budgetId = await ensureBudget(db, ctx, month)
      if (current.incomePaise === 0 && previous.incomePaise > 0) {
        const income = await db
          .from('budgets')
          .update({ income_paise: previous.incomePaise })
          .eq('id', budgetId)
        if (income.error) throw databaseError(income.error)
      }
      if (previous.items.length > 0) {
        // Plans carry over; this month's spending starts at zero.
        const { error } = await db.from('budget_items').insert(
          previous.items.map((item, position) => ({
            budget_id: budgetId,
            user_id: ctx.userId,
            label: item.label,
            kind: item.kind,
            planned_paise: item.plannedPaise,
            spent_paise: 0,
            position,
          })),
        )
        if (error) throw databaseError(error)
      }
      return loadBudget(db, month)
    },

    listGoals: (ctx) => loadGoals(clientFor(ctx.accessToken)),

    async createGoal(ctx, input) {
      const db = clientFor(ctx.accessToken)
      const active = await db
        .from('savings_goals')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
      if (active.error) throw databaseError(active.error)
      if ((active.count ?? 0) >= MAX_SAVINGS_GOALS) {
        throw new AppError(
          409,
          'conflict',
          `You can have up to ${MAX_SAVINGS_GOALS} savings goals. Archive one first.`,
        )
      }
      const { data, error } = await db
        .from('savings_goals')
        .insert({
          user_id: ctx.userId,
          name: input.name,
          target_paise: input.targetPaise,
          target_date: input.targetDate ?? null,
        })
        .select('id')
        .single()
      if (error) throw databaseError(error)
      return getGoal(db, data.id)
    },

    async updateGoal(ctx, goalId, patch) {
      const db = clientFor(ctx.accessToken)
      const archivedAt =
        patch.archived === undefined ? undefined : patch.archived ? new Date().toISOString() : null
      const { data, error } = await db
        .from('savings_goals')
        .update({
          name: patch.name,
          target_paise: patch.targetPaise,
          target_date: patch.targetDate,
          archived_at: archivedAt,
        })
        .eq('id', goalId)
        .select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw goalNotFound()
      return getGoal(db, goalId)
    },

    async deleteGoal(ctx, goalId) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('savings_goals')
        .delete()
        .eq('id', goalId)
        .select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw goalNotFound()
    },

    async addEntry(ctx, goalId, input) {
      const db = clientFor(ctx.accessToken)
      const { error } = await db.rpc('record_savings_entry', {
        p_goal_id: goalId,
        p_amount_paise: input.amountPaise,
        p_note: input.note ?? null,
        p_entry_date: input.entryDate ?? null,
      })
      if (error) throw savingsRuleError(error)
      return getGoal(db, goalId)
    },

    async deleteEntry(ctx, entryId) {
      const db = clientFor(ctx.accessToken)
      const entry = await db
        .from('savings_entries')
        .select('goal_id, amount_paise')
        .eq('id', entryId)
        .maybeSingle()
      if (entry.error) throw databaseError(entry.error)
      if (!entry.data) throw entryNotFound()
      // Removing a deposit must not leave the goal below zero (e.g. after a withdrawal).
      const goal = await getGoal(db, entry.data.goal_id)
      if (goal.savedPaise - entry.data.amount_paise < 0) {
        throw new AppError(
          409,
          'conflict',
          'Deleting this deposit would take the goal below zero. Delete the later withdrawal first.',
        )
      }
      const { data, error } = await db
        .from('savings_entries')
        .delete()
        .eq('id', entryId)
        .select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw entryNotFound()
      return getGoal(db, entry.data.goal_id)
    },
  }
}
