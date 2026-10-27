import { Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { breathingPatterns, sessionLengths } from '@/config/wellness'
import { usePageTitle } from '@/hooks/use-page-title'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { breathingStep } from '@/lib/breathing'
import { cn } from '@/lib/utils'

export default function BreathingPage() {
  usePageTitle('Breathing')
  const reducedMotion = useReducedMotion()
  const [patternId, setPatternId] = useState(breathingPatterns[0]!.id)
  const [minutes, setMinutes] = useState<number>(sessionLengths[0])
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const pattern = breathingPatterns.find((p) => p.id === patternId) ?? breathingPatterns[0]!
  const total = minutes * 60
  const finished = elapsed >= total
  // The clock stops by itself at the end of the session.
  const active = running && !finished

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(timer)
  }, [active])

  const step = breathingStep(pattern, elapsed)
  const started = elapsed > 0 || active
  // The circle grows while breathing in, shrinks while breathing out, and stays put on a hold.
  const expanded =
    step.phase.label === 'Breathe in' ||
    (step.phase.label === 'Hold' && step.previous.label === 'Breathe in')
  const reset = () => {
    setRunning(false)
    setElapsed(0)
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section
        aria-labelledby="breathing-title"
        className="rounded-lg border border-border bg-surface p-6 sm:p-8"
      >
        <h2 id="breathing-title" className="text-lg font-semibold text-ink">
          {pattern.name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{pattern.description}</p>

        <div className="my-10 flex flex-col items-center gap-6">
          <div className="relative grid size-56 place-items-center" aria-hidden>
            <div
              className={cn(
                'absolute inset-0 rounded-full bg-accent-subtle-strong ease-in-out',
                !reducedMotion && 'transition-transform',
              )}
              style={{
                transform: `scale(${started && expanded ? 1 : 0.55})`,
                transitionDuration: `${step.phase.seconds}s`,
              }}
            />
            <span className="relative text-4xl font-semibold text-ink tabular-nums">
              {started && !finished ? step.remaining : ''}
            </span>
          </div>
          {/* Announced to screen readers when the step changes, not every second. */}
          <p aria-live="polite" className="text-xl font-medium text-ink">
            {finished
              ? 'Well done. Breathe normally.'
              : started
                ? step.phase.label
                : 'Ready when you are'}
          </p>
          <div className="flex gap-3">
            {!active ? (
              <Button
                onClick={() => {
                  if (finished) setElapsed(0)
                  setRunning(true)
                }}
              >
                <Play className="size-4" aria-hidden />{' '}
                {elapsed > 0 && !finished ? 'Resume' : 'Start'}
              </Button>
            ) : (
              <Button onClick={() => setRunning(false)}>
                <Pause className="size-4" aria-hidden /> Pause
              </Button>
            )}
            {started && (
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="size-4" aria-hidden /> Reset
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground tabular-nums" aria-hidden>
            {Math.floor(Math.min(elapsed, total) / 60)}:
            {String(Math.min(elapsed, total) % 60).padStart(2, '0')} / {minutes}:00
          </p>
        </div>

        {reducedMotion && (
          <p className="text-center text-xs text-muted-foreground">
            Animation is off because your device asks for reduced motion. Follow the words and the
            countdown.
          </p>
        )}
      </section>

      <aside className="space-y-6">
        <fieldset disabled={active}>
          <legend className="text-sm font-medium text-ink">Exercise</legend>
          <div className="mt-2 space-y-2">
            {breathingPatterns.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="pattern"
                  className="mt-1"
                  checked={p.id === patternId}
                  onChange={() => {
                    setPatternId(p.id)
                    setElapsed(0)
                  }}
                />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={active}>
          <legend className="text-sm font-medium text-ink">Length</legend>
          <div className="mt-2 flex gap-2">
            {sessionLengths.map((m) => (
              <label
                key={m}
                className={cn(
                  'cursor-pointer rounded-md border px-3 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                  m === minutes
                    ? 'border-primary bg-accent-subtle text-accent-fg'
                    : 'border-border',
                )}
              >
                <input
                  type="radio"
                  name="minutes"
                  className="sr-only"
                  checked={m === minutes}
                  onChange={() => {
                    setMinutes(m)
                    setElapsed(0)
                  }}
                />
                {m} min
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Breathe gently through your nose if you can. If you feel dizzy or uncomfortable, stop and
          breathe normally. This exercise isn’t a treatment for any condition.
        </p>
      </aside>
    </div>
  )
}
