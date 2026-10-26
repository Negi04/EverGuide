const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "just now", "5 minutes ago", "yesterday", or a date for older items. */
export function formatRelative(iso: string, now = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return 'just now'
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day')
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** The time zone to show times in: the user's profile setting, else the browser's. */
export function displayTimeZone(profileTimeZone?: string | null): string {
  return profileTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function formatDay(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  })
}

export function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone })
}

/** "Mon 27 Oct, 10:00 am – 10:30 am" in the given time zone. */
export function formatSession(startsAt: string, endsAt: string, timeZone: string): string {
  return `${formatDay(startsAt, timeZone)}, ${formatTime(startsAt, timeZone)} – ${formatTime(endsAt, timeZone)}`
}

/** Calendar-day key (YYYY-MM-DD) for grouping times by day in a time zone. */
export function dayKey(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone })
}

/** Dates are stored as YYYY-MM-DD and shown without any time-zone shift. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** A calendar date (YYYY-MM-DD) as a short weekday label, e.g. "Mon 26". */
export function formatWeekday(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

/** Integer paise as rupees, Indian style: 15000000 → "₹1,50,000", 150050 → "₹1,500.50". */
export function formatPaise(paise: number): string {
  return paise % 100 === 0 ? inrWhole.format(paise / 100) : inr.format(paise / 100)
}

/** A calculated rupee amount, rounded to the nearest rupee: 2323390.76 → "₹23,23,391". */
export function formatRupees(rupees: number): string {
  return inrWhole.format(Math.round(rupees))
}

/** 'YYYY-MM' as "October 2026". */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year!, m! - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
