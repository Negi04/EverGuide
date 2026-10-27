import { addDays, habitCreateSchema, type Habit, type HabitUpdate } from '@everguide/shared'
import { useMutation } from '@tanstack/react-query'
import { Archive, Check, Flame, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { EmptyState } from '@/components/common/empty-state'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, NativeSelect } from '@/components/ui/input'
import { habitTargets } from '@/config/wellness'
import { usePageTitle } from '@/hooks/use-page-title'
import { useHabits, useUpdateHabitCache } from '@/hooks/use-wellness'
import { api } from '@/lib/api'
import { formatDate, formatWeekday } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function HabitsPage() {
  usePageTitle('Habits')
  const habits = useHabits()

  if (habits.isPending) return <PageLoader label="Loading habits…" />
  if (habits.isError) return <p className="text-danger">{habits.error.message}</p>

  const { today } = habits.data
  const active = habits.data.habits.filter((h) => !h.archived)
  const archived = habits.data.habits.filter((h) => h.archived)
  // The last 7 days, oldest first, ending today in the person's own time zone.
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))

  return (
    <div className="space-y-8">
      <AddHabitForm />
      {active.length === 0 ? (
        <EmptyState icon={Flame} title="No habits yet">
          <p>Start with one small thing you’d like to do regularly, like a 10-minute walk.</p>
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {active.map((habit) => (
            <li key={habit.id}>
              <HabitCard habit={habit} week={week} today={today} />
            </li>
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <details className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink">
            Archived habits ({archived.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {archived.map((habit) => (
              <li key={habit.id}>
                <ArchivedHabit habit={habit} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function AddHabitForm() {
  const updateCache = useUpdateHabitCache()
  const [name, setName] = useState('')
  const [target, setTarget] = useState(7)
  const [problem, setProblem] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: (input: { name: string; targetPerWeek: number }) => api.createHabit(input),
    onSuccess: (habit) => {
      updateCache({ put: habit })
      setName('')
      setTarget(7)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const checked = habitCreateSchema.safeParse({ name, targetPerWeek: target })
    if (!checked.success) return setProblem(checked.error.issues[0]?.message ?? 'Check the habit.')
    setProblem(null)
    create.mutate(checked.data)
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Add a habit"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-end"
    >
      <FormField label="New habit" className="flex-1">
        <Input
          value={name}
          maxLength={80}
          placeholder="e.g. Walk for 10 minutes"
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      <FormField label="How often">
        <NativeSelect value={target} onChange={(e) => setTarget(Number(e.target.value))}>
          {habitTargets.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <Button type="submit" disabled={create.isPending}>
        <Plus className="size-4" aria-hidden /> Add
      </Button>
      {(problem ?? create.error) && (
        <FormAlert tone="error" className="sm:basis-full">
          {problem ?? create.error?.message}
        </FormAlert>
      )}
    </form>
  )
}

function HabitCard({ habit, week, today }: { habit: Habit; week: string[]; today: string }) {
  const updateCache = useUpdateHabitCache()
  // Days being saved right now, shown immediately (the cache updates a moment later).
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const toggle = useMutation({
    mutationFn: ({ date, done }: { date: string; done: boolean }) =>
      api.setHabitCheckin(habit.id, date, done),
    onSuccess: (updated) => updateCache({ put: updated }),
    onSettled: (_data, _error, { date }) =>
      setPending((p) => {
        const rest = { ...p }
        delete rest[date]
        return rest
      }),
  })
  const update = useMutation({
    mutationFn: (patch: HabitUpdate) => api.updateHabit(habit.id, patch),
    onSuccess: (updated) => updateCache({ put: updated }),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteHabit(habit.id),
    onSuccess: () => updateCache({ remove: habit.id }),
  })

  const done = new Set(habit.checkins)
  const { streak, streakUnit, thisWeek } = habit.stats
  const target = habitTargets.find((t) => t.value === habit.targetPerWeek)?.label
  const error = toggle.error ?? update.error ?? remove.error

  return (
    <article
      aria-labelledby={`habit-${habit.id}`}
      className="rounded-lg border border-border bg-surface p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`habit-${habit.id}`} className="text-base font-semibold text-ink">
            {habit.name}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {target} · {thisWeek} this week
          </p>
        </div>
        <p
          className={cn(
            'flex items-center gap-1 text-sm font-medium',
            streak > 0 ? 'text-accent-text' : 'text-muted-foreground',
          )}
        >
          <Flame className="size-4" aria-hidden />
          {streak > 0 ? `${streak}-${streakUnit} streak` : 'No streak yet'}
        </p>
      </header>

      <div
        role="group"
        aria-label={`${habit.name}: last 7 days`}
        className="mt-4 grid grid-cols-7 gap-1.5"
      >
        {week.map((date) => {
          const checked = pending[date] ?? done.has(date)
          return (
            <button
              key={date}
              type="button"
              aria-pressed={checked}
              aria-label={`${formatDate(date)}${date === today ? ' (today)' : ''}`}
              onClick={() => {
                setPending((p) => ({ ...p, [date]: !checked }))
                toggle.mutate({ date, done: !checked })
              }}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md border py-2 text-xs transition-colors',
                checked
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary',
                date === today && !checked && 'border-primary/60',
              )}
            >
              <span aria-hidden className="flex flex-col leading-tight">
                {formatWeekday(date)
                  .split(' ')
                  .map((part) => (
                    <span key={part}>{part}</span>
                  ))}
              </span>
              <Check className={cn('size-4', !checked && 'opacity-0')} aria-hidden />
            </button>
          )
        })}
      </div>

      {error && <FormAlert tone="error">{error.message}</FormAlert>}
      <div className="mt-4 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={update.isPending}
          onClick={() => update.mutate({ archived: true })}
        >
          <Archive className="size-4" aria-hidden /> Archive
        </Button>
        <DeleteHabit habit={habit} busy={remove.isPending} onConfirm={() => remove.mutate()} />
      </div>
    </article>
  )
}

function ArchivedHabit({ habit }: { habit: Habit }) {
  const updateCache = useUpdateHabitCache()
  const restore = useMutation({
    mutationFn: () => api.updateHabit(habit.id, { archived: false }),
    onSuccess: (updated) => updateCache({ put: updated }),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteHabit(habit.id),
    onSuccess: () => updateCache({ remove: habit.id }),
  })
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{habit.name}</span>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={restore.isPending}
          onClick={() => restore.mutate()}
        >
          <RotateCcw className="size-4" aria-hidden /> Restore
        </Button>
        <DeleteHabit habit={habit} busy={remove.isPending} onConfirm={() => remove.mutate()} />
      </div>
    </div>
  )
}

function DeleteHabit({
  habit,
  busy,
  onConfirm,
}: {
  habit: Habit
  busy: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Trash2 className="size-4" aria-hidden /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete “{habit.name}”?</DialogTitle>
        <DialogDescription>
          The habit and all its check-ins will be removed permanently. To keep its history, archive
          it instead.
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-3">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button className="bg-danger hover:bg-danger/90" disabled={busy} onClick={onConfirm}>
            Delete habit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
