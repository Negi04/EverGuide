import type { BreathingPattern } from '@/config/wellness'

/** Where a session is after `elapsed` seconds: the current step and seconds left in it. */
export function breathingStep(pattern: BreathingPattern, elapsed: number) {
  const cycle = pattern.phases.reduce((sum, p) => sum + p.seconds, 0)
  let position = elapsed % cycle
  for (let index = 0; index < pattern.phases.length; index++) {
    const phase = pattern.phases[index]!
    if (position < phase.seconds) {
      const previous = pattern.phases[(index - 1 + pattern.phases.length) % pattern.phases.length]!
      return { phase, index, previous, remaining: phase.seconds - position }
    }
    position -= phase.seconds
  }
  throw new Error('unreachable')
}
