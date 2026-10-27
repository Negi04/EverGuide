/**
 * Calendar-date helpers working on 'YYYY-MM-DD' strings. Dates are handled as UTC
 * midnights internally, so adding days never trips over daylight-saving changes.
 */

const DAY_MS = 86_400_000

/** Today's date (YYYY-MM-DD) in an IANA time zone, e.g. 'Asia/Kolkata'. */
export function localDate(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`)
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
}

/** The Monday of the ISO week containing `date`. */
export function weekStart(date: string): string {
  const weekday = new Date(toUtc(date)).getUTCDay() // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7))
}

/** The first day of the month containing `date`. */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}
