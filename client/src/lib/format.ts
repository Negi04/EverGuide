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
