import { useEffect, useState } from 'react'

/**
 * The current time, kept in state and refreshed every `intervalMs`. Rendering with
 * Date.now() directly would be impure (a different answer on every render); this also
 * keeps time-based UI, like "can still cancel", current while a page stays open.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
