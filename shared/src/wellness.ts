import { z } from 'zod'
import { addDays, weekStart } from './dates.ts'

const isoDate = z.iso.date({ error: 'Use a valid date.' })
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional()

// ---------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------

export const MAX_JOURNAL_CHARS = 20_000

const journalBody = z
  .string({ error: 'Write something first.' })
  .trim()
  .min(1, 'Write something first.')
  .max(
    MAX_JOURNAL_CHARS,
    `Keep an entry under ${MAX_JOURNAL_CHARS.toLocaleString('en-IN')} characters.`,
  )
const mood = z.number().int().min(1).max(5)

export const journalEntryCreateSchema = z.object({
  entryDate: isoDate,
  mood: mood.nullable().optional(),
  title: optionalText(120),
  body: journalBody,
})

export const journalEntryUpdateSchema = z
  .object({
    entryDate: isoDate,
    mood: mood.nullable(),
    title: optionalText(120),
    body: journalBody,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

export const journalQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
})

export type JournalEntryCreate = z.input<typeof journalEntryCreateSchema>
export type JournalEntryUpdate = z.infer<typeof journalEntryUpdateSchema>

export type JournalEntry = {
  id: string
  entryDate: string
  mood: number | null
  title: string | null
  body: string
  createdAt: string
  updatedAt: string
}

export type JournalPage = { entries: JournalEntry[]; nextOffset: number | null }

// ---------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------

export const MAX_ACTIVE_HABITS = 20
/** How far back a missed check-in can still be added. */
export const HABIT_BACKFILL_DAYS = 30

const habitName = z
  .string({ error: 'Name the habit.' })
  .trim()
  .min(1, 'Name the habit.')
  .max(80, 'Keep the name under 80 characters.')
const targetPerWeek = z.number().int().min(1).max(7)

export const habitCreateSchema = z.object({
  name: habitName,
  targetPerWeek: targetPerWeek.default(7),
})

export const habitUpdateSchema = z
  .object({ name: habitName, targetPerWeek, archived: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

export type HabitCreate = z.input<typeof habitCreateSchema>
export type HabitUpdate = z.infer<typeof habitUpdateSchema>

export type HabitStats = {
  /** Days in a row for daily habits; weeks in a row meeting the target otherwise. */
  streak: number
  streakUnit: 'day' | 'week'
  /** Check-ins in the current week (Monday to Sunday). */
  thisWeek: number
}

export type Habit = {
  id: string
  name: string
  targetPerWeek: number
  archived: boolean
  createdAt: string
  /** Check-in dates (YYYY-MM-DD) from the last few weeks, newest first. */
  checkins: string[]
  stats: HabitStats
}

/** `today` is the person's own date, so each list knows which day is "today". */
export type HabitList = { today: string; habits: Habit[] }

/**
 * Streak and weekly progress for a habit. Pure: works on calendar dates in the
 * person's time zone. A day (or week) that isn't over yet never breaks a streak.
 */
export function habitStats(checkins: string[], today: string, target: number): HabitStats {
  const days = new Set(checkins)
  const thisWeekStart = weekStart(today)
  let thisWeek = 0
  for (let i = 0; i < 7; i++) if (days.has(addDays(thisWeekStart, i))) thisWeek++

  if (target >= 7) {
    // Count back from today, or from yesterday if today isn't checked yet.
    let day = days.has(today) ? today : addDays(today, -1)
    let streak = 0
    while (days.has(day)) {
      streak++
      day = addDays(day, -1)
    }
    return { streak, streakUnit: 'day', thisWeek }
  }

  const countWeek = (start: string) => {
    let n = 0
    for (let i = 0; i < 7; i++) if (days.has(addDays(start, i))) n++
    return n
  }
  // The current week counts once its target is met; until then it doesn't break the run.
  let streak = thisWeek >= target ? 1 : 0
  let start = addDays(thisWeekStart, -7)
  while (countWeek(start) >= target) {
    streak++
    start = addDays(start, -7)
  }
  return { streak, streakUnit: 'week', thisWeek }
}
