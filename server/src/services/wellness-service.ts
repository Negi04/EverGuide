import {
  addDays,
  daysBetween,
  HABIT_BACKFILL_DAYS,
  habitStats,
  localDate,
  MAX_ACTIVE_HABITS,
  type Habit,
  type HabitCreate,
  type HabitList,
  type HabitUpdate,
  type JournalEntry,
  type JournalEntryCreate,
  type JournalEntryUpdate,
  type JournalPage,
} from '@everguide/shared'
import { AppError, databaseError } from '../lib/errors.ts'
import { fetchAllPages } from '../lib/paging.ts'
import type { Db } from '../lib/supabase.ts'
import type { UserContext } from './profile-service.ts'

export interface WellnessService {
  listJournal(ctx: UserContext, query: { q?: string; offset: number }): Promise<JournalPage>
  createJournalEntry(ctx: UserContext, input: JournalEntryCreate): Promise<JournalEntry>
  updateJournalEntry(ctx: UserContext, id: string, patch: JournalEntryUpdate): Promise<JournalEntry>
  deleteJournalEntry(ctx: UserContext, id: string): Promise<void>
  listHabits(ctx: UserContext): Promise<HabitList>
  createHabit(ctx: UserContext, input: HabitCreate): Promise<Habit>
  updateHabit(ctx: UserContext, id: string, patch: HabitUpdate): Promise<Habit>
  deleteHabit(ctx: UserContext, id: string): Promise<void>
  setCheckin(ctx: UserContext, habitId: string, date: string, done: boolean): Promise<Habit>
}

const JOURNAL_PAGE = 20
const JOURNAL_COLUMNS = 'id, entry_date, mood, title, body, created_at, updated_at'
const HABIT_COLUMNS = 'id, name, target_per_week, archived_at, created_at'
/** Check-ins older than this don't affect streaks shown to the user. */
const STATS_WINDOW_DAYS = 400
/** Check-ins sent to the browser (enough for the last few weeks' grid). */
const RECENT_CHECKIN_DAYS = 35

const entryNotFound = () => new AppError(404, 'not_found', 'Journal entry not found.')
const habitNotFound = () => new AppError(404, 'not_found', 'Habit not found.')

type JournalRow = {
  id: string
  entry_date: string
  mood: number | null
  title: string | null
  body: string
  created_at: string
  updated_at: string
}
type HabitRow = {
  id: string
  name: string
  target_per_week: number
  archived_at: string | null
  created_at: string
}

const toEntry = (row: JournalRow): JournalEntry => ({
  id: row.id,
  entryDate: row.entry_date,
  mood: row.mood,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

/**
 * Search text for a PostgREST filter. Characters with meaning in the filter syntax
 * (commas, brackets, quotes) or in LIKE patterns (%, _, \) are dropped, so a search
 * can't change the query; the rest is quoted.
 */
export function searchPattern(q: string): string | null {
  const cleaned = q
    .replace(/[%_\\"(),*:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned ? `"%${cleaned}%"` : null
}

/**
 * Journal and habits. Everything runs as the signed-in user, so RLS (plus the
 * composite foreign key on check-ins) keeps each person's data private. Dates are
 * calendar days in the person's own time zone.
 */
export function createWellnessService(clientFor: (accessToken: string) => Db): WellnessService {
  async function today(db: Db, ctx: UserContext): Promise<string> {
    const { data, error } = await db
      .from('profiles')
      .select('timezone')
      .eq('id', ctx.userId)
      .single()
    if (error) throw databaseError(error)
    try {
      return localDate(data.timezone)
    } catch {
      return localDate('UTC') // an unknown zone name shouldn't break the page
    }
  }

  async function checkinsFor(db: Db, habitIds: string[], since: string) {
    if (habitIds.length === 0) return []
    try {
      return await fetchAllPages((from, to) =>
        db
          .from('habit_checkins')
          .select('habit_id, checkin_date')
          .in('habit_id', habitIds)
          .gte('checkin_date', since)
          .order('checkin_date', { ascending: false })
          .order('habit_id')
          .range(from, to),
      )
    } catch (error) {
      throw databaseError(error)
    }
  }

  async function loadHabits(ctx: UserContext, habitId?: string): Promise<HabitList> {
    const db = clientFor(ctx.accessToken)
    const day = await today(db, ctx)
    let query = db.from('habits').select(HABIT_COLUMNS).order('created_at').limit(100)
    if (habitId) query = query.eq('id', habitId)
    const habits = await query
    if (habits.error) throw databaseError(habits.error)

    const checkins = await checkinsFor(
      db,
      habits.data.map((h: HabitRow) => h.id),
      addDays(day, -STATS_WINDOW_DAYS),
    )
    const recentFrom = addDays(day, -RECENT_CHECKIN_DAYS)
    return {
      today: day,
      habits: habits.data.map((h: HabitRow): Habit => {
        const dates = checkins.filter((c) => c.habit_id === h.id).map((c) => c.checkin_date)
        return {
          id: h.id,
          name: h.name,
          targetPerWeek: h.target_per_week,
          archived: h.archived_at !== null,
          createdAt: h.created_at,
          checkins: dates.filter((d) => d >= recentFrom),
          stats: habitStats(dates, day, h.target_per_week),
        }
      }),
    }
  }

  async function getHabit(ctx: UserContext, habitId: string): Promise<Habit> {
    const { habits } = await loadHabits(ctx, habitId)
    const habit = habits[0]
    if (!habit) throw habitNotFound()
    return habit
  }

  return {
    async listJournal(ctx, { q, offset }) {
      let query = clientFor(ctx.accessToken)
        .from('journal_entries')
        .select(JOURNAL_COLUMNS)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        // One extra row tells us whether there's another page.
        .range(offset, offset + JOURNAL_PAGE)
      const pattern = q ? searchPattern(q) : null
      if (pattern) query = query.or(`title.ilike.${pattern},body.ilike.${pattern}`)
      const { data, error } = await query
      if (error) throw databaseError(error)
      return {
        entries: data.slice(0, JOURNAL_PAGE).map(toEntry),
        nextOffset: data.length > JOURNAL_PAGE ? offset + JOURNAL_PAGE : null,
      }
    },

    async createJournalEntry(ctx, input) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('journal_entries')
        .insert({
          user_id: ctx.userId,
          entry_date: input.entryDate,
          mood: input.mood ?? null,
          title: input.title ?? null,
          body: input.body,
        })
        .select(JOURNAL_COLUMNS)
        .single()
      if (error) throw databaseError(error)
      return toEntry(data)
    },

    async updateJournalEntry(ctx, id, patch) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('journal_entries')
        .update({
          entry_date: patch.entryDate,
          mood: patch.mood,
          title: patch.title,
          body: patch.body,
        })
        .eq('id', id)
        .select(JOURNAL_COLUMNS)
      if (error) throw databaseError(error)
      const row = data[0]
      if (!row) throw entryNotFound()
      return toEntry(row)
    },

    async deleteJournalEntry(ctx, id) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('journal_entries')
        .delete()
        .eq('id', id)
        .select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw entryNotFound()
    },

    listHabits: (ctx) => loadHabits(ctx),

    async createHabit(ctx, input) {
      const db = clientFor(ctx.accessToken)
      const active = await db
        .from('habits')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
      if (active.error) throw databaseError(active.error)
      if ((active.count ?? 0) >= MAX_ACTIVE_HABITS) {
        throw new AppError(
          409,
          'conflict',
          `You can track up to ${MAX_ACTIVE_HABITS} habits. Archive one first.`,
        )
      }
      const { data, error } = await db
        .from('habits')
        .insert({
          user_id: ctx.userId,
          name: input.name,
          target_per_week: input.targetPerWeek ?? 7,
        })
        .select('id')
        .single()
      if (error) throw databaseError(error)
      return getHabit(ctx, data.id)
    },

    async updateHabit(ctx, id, patch) {
      const archivedAt =
        patch.archived === undefined ? undefined : patch.archived ? new Date().toISOString() : null
      const { data, error } = await clientFor(ctx.accessToken)
        .from('habits')
        .update({ name: patch.name, target_per_week: patch.targetPerWeek, archived_at: archivedAt })
        .eq('id', id)
        .select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw habitNotFound()
      return getHabit(ctx, id)
    },

    async deleteHabit(ctx, id) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('habits')
        .delete()
        .eq('id', id)
        .select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw habitNotFound()
    },

    async setCheckin(ctx, habitId, date, done) {
      const db = clientFor(ctx.accessToken)
      const day = await today(db, ctx)
      const age = daysBetween(date, day)
      if (age < 0)
        throw new AppError(400, 'validation_failed', 'You can’t check in for a future day.')
      if (age > HABIT_BACKFILL_DAYS) {
        throw new AppError(
          400,
          'validation_failed',
          `You can add check-ins for the last ${HABIT_BACKFILL_DAYS} days.`,
        )
      }

      const habit = await db
        .from('habits')
        .select('id, archived_at')
        .eq('id', habitId)
        .maybeSingle()
      if (habit.error) throw databaseError(habit.error)
      if (!habit.data) throw habitNotFound()
      if (habit.data.archived_at) {
        throw new AppError(409, 'conflict', 'Restore this habit before checking in.')
      }

      const { error } = done
        ? await db
            .from('habit_checkins')
            .upsert(
              { habit_id: habitId, user_id: ctx.userId, checkin_date: date },
              { onConflict: 'habit_id,checkin_date', ignoreDuplicates: true },
            )
        : await db.from('habit_checkins').delete().eq('habit_id', habitId).eq('checkin_date', date)
      if (error) throw databaseError(error)
      return getHabit(ctx, habitId)
    },
  }
}
