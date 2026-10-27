import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, localDate, monthStart, weekStart } from './dates.ts'
import { habitStats, journalEntryCreateSchema } from './wellness.ts'

describe('dates', () => {
  it('gives "today" in the person\'s own time zone', () => {
    // 20:00 UTC on 25 Oct is already 26 Oct in India, still 25 Oct in New York.
    const now = new Date('2026-10-25T20:00:00Z')
    expect(localDate('Asia/Kolkata', now)).toBe('2026-10-26')
    expect(localDate('America/New_York', now)).toBe('2026-10-25')
  })

  it('adds days across month ends, leap days and daylight-saving changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
    expect(daysBetween('2026-10-25', '2026-11-08')).toBe(14)
  })

  it('finds the Monday of the week and the first of the month', () => {
    expect(weekStart('2026-10-26')).toBe('2026-10-26') // a Monday
    expect(weekStart('2026-11-01')).toBe('2026-10-26') // a Sunday
    expect(monthStart('2026-10-26')).toBe('2026-10-01')
  })
})

describe('habitStats (daily)', () => {
  const today = '2026-10-28' // Wednesday

  it('counts consecutive days ending today', () => {
    expect(habitStats(['2026-10-28', '2026-10-27', '2026-10-26'], today, 7).streak).toBe(3)
  })

  it("doesn't break the streak just because today isn't done yet", () => {
    expect(habitStats(['2026-10-27', '2026-10-26'], today, 7).streak).toBe(2)
  })

  it('a missed day ends the streak', () => {
    expect(habitStats(['2026-10-28', '2026-10-26', '2026-10-25'], today, 7).streak).toBe(1)
    expect(habitStats(['2026-10-26'], today, 7).streak).toBe(0)
  })

  it('counts check-ins this week (Monday to Sunday)', () => {
    const stats = habitStats(['2026-10-28', '2026-10-26', '2026-10-25'], today, 7)
    expect(stats.thisWeek).toBe(2)
    expect(stats.streakUnit).toBe('day')
  })
})

describe('habitStats (a few times a week)', () => {
  const today = '2026-10-28' // Wednesday of the week starting 26 Oct
  const lastWeek = ['2026-10-19', '2026-10-21', '2026-10-23']
  const weekBefore = ['2026-10-12', '2026-10-14', '2026-10-16']

  it('counts weeks in a row that met the target', () => {
    expect(habitStats([...lastWeek, ...weekBefore], today, 3)).toEqual({
      streak: 2,
      streakUnit: 'week',
      thisWeek: 0,
    })
  })

  it('the current week joins the streak once its target is met', () => {
    const thisWeek = ['2026-10-26', '2026-10-27', '2026-10-28']
    expect(habitStats([...thisWeek, ...lastWeek], today, 3).streak).toBe(2)
  })

  it('a week below target ends the streak', () => {
    expect(habitStats([...lastWeek, '2026-10-12'], today, 3).streak).toBe(1)
  })
})

describe('journal entry validation', () => {
  it('requires text and a real date; mood 1-5', () => {
    expect(
      journalEntryCreateSchema.safeParse({ entryDate: '2026-10-26', body: '  ' }).success,
    ).toBe(false)
    expect(
      journalEntryCreateSchema.safeParse({ entryDate: '2026-02-30', body: 'Hello' }).success,
    ).toBe(false)
    expect(
      journalEntryCreateSchema.safeParse({ entryDate: '2026-10-26', body: 'Hi', mood: 6 }).success,
    ).toBe(false)
    expect(
      journalEntryCreateSchema.parse({ entryDate: '2026-10-26', body: ' Hi ', title: '' }),
    ).toEqual({ entryDate: '2026-10-26', body: 'Hi', title: null })
  })
})
