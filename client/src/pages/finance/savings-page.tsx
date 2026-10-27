import {
  daysBetween,
  localDate,
  savingsGoalCreateSchema,
  type SavingsEntryInput,
  type SavingsGoal,
} from '@everguide/shared'
import { useMutation } from '@tanstack/react-query'
import { Archive, Minus, PiggyBank, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { EmptyState } from '@/components/common/empty-state'
import { FormAlert } from '@/components/common/form-alert'
import { Notice } from '@/components/common/notice'
import { PageLoader } from '@/components/common/page-loader'
import { MoneyInput } from '@/components/finance/money-input'
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
import { Input } from '@/components/ui/input'
import { EDUCATION_NOTICE } from '@/config/finance'
import { useSavingsGoals, useUpdateGoalCache } from '@/hooks/use-finance'
import { useMe } from '@/hooks/use-me'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { displayTimeZone, formatDate, formatPaise } from '@/lib/format'

export default function SavingsPage() {
  usePageTitle('Savings goals')
  const goals = useSavingsGoals()

  if (goals.isPending) return <PageLoader label="Loading savings goals…" />
  if (goals.isError) return <p className="text-danger">{goals.error.message}</p>

  const active = goals.data.filter((g) => !g.archived)
  const archived = goals.data.filter((g) => g.archived)

  return (
    <div className="space-y-8">
      <Notice>{EDUCATION_NOTICE}</Notice>
      <NewGoalForm />
      {active.length === 0 ? (
        <EmptyState icon={PiggyBank} title="No savings goals yet">
          <p>An emergency fund is a common first goal: a few months of essential costs.</p>
        </EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {active.map((goal) => (
            <li key={goal.id}>
              <GoalCard goal={goal} />
            </li>
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <details className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink">
            Archived goals ({archived.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {archived.map((goal) => (
              <li key={goal.id}>
                <ArchivedGoal goal={goal} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function NewGoalForm() {
  const updateCache = useUpdateGoalCache()
  const [name, setName] = useState('')
  const [target, setTarget] = useState(0)
  const [targetDate, setTargetDate] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: (input: { name: string; targetPaise: number; targetDate: string | null }) =>
      api.createSavingsGoal(input),
    onSuccess: (goal) => {
      updateCache({ put: goal })
      setName('')
      setTarget(0)
      setTargetDate('')
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const input = { name, targetPaise: target, targetDate: targetDate || null }
    const checked = savingsGoalCreateSchema.safeParse(input)
    if (!checked.success) return setProblem(checked.error.issues[0]?.message ?? 'Check the goal.')
    setProblem(null)
    create.mutate(input)
  }

  return (
    <form
      onSubmit={submit}
      aria-label="New savings goal"
      className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_10rem_11rem_auto] sm:items-end"
    >
      <FormField label="New goal">
        <Input
          value={name}
          maxLength={80}
          placeholder="e.g. Emergency fund"
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      <FormField label="Target amount">
        <MoneyInput value={target} onValueChange={setTarget} />
      </FormField>
      <FormField label="By (optional)">
        <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </FormField>
      <Button type="submit" disabled={create.isPending}>
        <Plus className="size-4" aria-hidden /> Add goal
      </Button>
      {(problem ?? create.error) && (
        <FormAlert tone="error" className="sm:col-span-4">
          {problem ?? create.error?.message}
        </FormAlert>
      )}
    </form>
  )
}

/** Monthly amount still needed to reach the target by its date (null if no date or done). */
function monthlyNeeded(goal: SavingsGoal, today: string): number | null {
  const remaining = goal.targetPaise - goal.savedPaise
  if (!goal.targetDate || remaining <= 0) return null
  const months = Math.max(1, Math.ceil(daysBetween(today, goal.targetDate) / 30.44))
  return Math.ceil(remaining / months / 100) * 100 // round up to whole rupees
}

function GoalCard({ goal }: { goal: SavingsGoal }) {
  const { data: me } = useMe()
  const today = localDate(displayTimeZone(me?.timezone))
  const updateCache = useUpdateGoalCache()
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const record = useMutation({
    mutationFn: (input: SavingsEntryInput) => api.addSavingsEntry(goal.id, input),
    onSuccess: (updated) => {
      updateCache({ put: updated })
      setAmount(0)
      setNote('')
    },
  })
  const removeEntry = useMutation({
    mutationFn: (id: string) => api.deleteSavingsEntry(id),
    onSuccess: (updated) => updateCache({ put: updated }),
  })
  const archive = useMutation({
    mutationFn: () => api.updateSavingsGoal(goal.id, { archived: true }),
    onSuccess: (updated) => updateCache({ put: updated }),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteSavingsGoal(goal.id),
    onSuccess: () => updateCache({ remove: goal.id }),
  })

  const percent = Math.min(100, Math.round((goal.savedPaise / goal.targetPaise) * 100))
  const reached = goal.savedPaise >= goal.targetPaise
  const perMonth = monthlyNeeded(goal, today)
  const overdue = goal.targetDate !== null && goal.targetDate < today && !reached
  const error = record.error ?? removeEntry.error ?? archive.error ?? remove.error
  const save = (direction: 1 | -1) => {
    if (amount > 0) record.mutate({ amountPaise: direction * amount, note: note || undefined })
  }

  return (
    <article
      aria-labelledby={`goal-${goal.id}`}
      className="flex h-full flex-col rounded-lg border border-border bg-surface p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`goal-${goal.id}`} className="text-base font-semibold text-ink">
            {goal.name}
          </h3>
          {goal.targetDate && (
            <p className={overdue ? 'text-sm text-danger' : 'text-sm text-muted-foreground'}>
              Target date: {formatDate(goal.targetDate)}
            </p>
          )}
        </div>
        {reached && <span className="text-sm font-medium text-success">Reached 🎉</span>}
      </header>

      <p className="mt-4 text-sm tabular-nums">
        <span className="text-xl font-semibold text-ink">{formatPaise(goal.savedPaise)}</span>{' '}
        <span className="text-muted-foreground">of {formatPaise(goal.targetPaise)}</span>
      </p>
      <div
        role="progressbar"
        aria-label={`${goal.name} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      {perMonth !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          About {formatPaise(perMonth)} a month would get you there by the target date.
        </p>
      )}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <MoneyInput
          aria-label={`Amount for ${goal.name}`}
          value={amount}
          onValueChange={setAmount}
        />
        <Input
          aria-label={`Note for ${goal.name}`}
          placeholder="Note (optional)"
          maxLength={120}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={record.isPending || amount <= 0} onClick={() => save(1)}>
          <Plus className="size-4" aria-hidden /> Add savings
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={record.isPending || amount <= 0}
          onClick={() => save(-1)}
        >
          <Minus className="size-4" aria-hidden /> Withdraw
        </Button>
      </div>
      {error && <FormAlert tone="error">{error.message}</FormAlert>}

      {goal.entries.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Recent activity</summary>
          <ul className="mt-2 divide-y divide-border">
            {goal.entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 py-1.5">
                <span className="w-24 shrink-0 text-muted-foreground">
                  {formatDate(entry.entryDate)}
                </span>
                <span className="min-w-0 flex-1 truncate">{entry.note ?? ''}</span>
                <span
                  className={
                    entry.amountPaise < 0 ? 'text-danger tabular-nums' : 'text-success tabular-nums'
                  }
                >
                  {entry.amountPaise < 0 ? '−' : '+'}
                  {formatPaise(Math.abs(entry.amountPaise))}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${formatPaise(Math.abs(entry.amountPaise))} entry from ${formatDate(entry.entryDate)}`}
                  className="rounded p-1 text-muted-foreground hover:text-danger"
                  onClick={() => removeEntry.mutate(entry.id)}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-auto flex gap-2 pt-4">
        <Button
          variant="ghost"
          size="sm"
          disabled={archive.isPending}
          onClick={() => archive.mutate()}
        >
          <Archive className="size-4" aria-hidden /> Archive
        </Button>
        <DeleteGoal goal={goal} busy={remove.isPending} onConfirm={() => remove.mutate()} />
      </div>
    </article>
  )
}

function ArchivedGoal({ goal }: { goal: SavingsGoal }) {
  const updateCache = useUpdateGoalCache()
  const restore = useMutation({
    mutationFn: () => api.updateSavingsGoal(goal.id, { archived: false }),
    onSuccess: (updated) => updateCache({ put: updated }),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteSavingsGoal(goal.id),
    onSuccess: () => updateCache({ remove: goal.id }),
  })
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>
        {goal.name} · {formatPaise(goal.savedPaise)} saved
      </span>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={restore.isPending}
          onClick={() => restore.mutate()}
        >
          <RotateCcw className="size-4" aria-hidden /> Restore
        </Button>
        <DeleteGoal goal={goal} busy={remove.isPending} onConfirm={() => remove.mutate()} />
      </div>
    </div>
  )
}

function DeleteGoal({
  goal,
  busy,
  onConfirm,
}: {
  goal: SavingsGoal
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
        <DialogTitle>Delete “{goal.name}”?</DialogTitle>
        <DialogDescription>
          The goal and its history will be removed permanently. This doesn’t touch any real money;
          it only removes your record here.
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-3">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button className="bg-danger hover:bg-danger/90" disabled={busy} onClick={onConfirm}>
            Delete goal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
