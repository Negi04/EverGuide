import type { Goal, GoalUpdate, Milestone } from '@everguide/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  PencilLine,
  Plus,
  RotateCcw,
  Archive,
  Trash2,
  X,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/use-auth'
import { FormAlert } from '@/components/common/form-alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { goalCategoryLabels } from '@/config/career'
import { careerKeys, formatDate, goalProgress, isOverdue, useReplaceGoal } from '@/hooks/use-career'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { GoalFormDialog } from './goal-form-dialog'

export function GoalCard({ goal }: { goal: Goal }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const replaceGoal = useReplaceGoal()
  const [newMilestone, setNewMilestone] = useState('')
  const [showReading, setShowReading] = useState(false)
  const progress = goalProgress(goal)
  const completed = goal.status === 'completed'
  const overdue = !completed && isOverdue(goal.targetDate)

  const update = useMutation({
    mutationFn: (patch: GoalUpdate) => api.updateGoal(goal.id, patch),
    onSuccess: replaceGoal,
  })
  const remove = useMutation({
    mutationFn: () => api.deleteGoal(goal.id),
    onSuccess: () =>
      queryClient.setQueryData<Goal[]>(careerKeys.goals(user?.id), (old) =>
        old?.filter((g) => g.id !== goal.id),
      ),
  })
  const addMilestone = useMutation({
    mutationFn: (title: string) => api.addMilestone(goal.id, { title }),
    onSuccess: (updated) => {
      replaceGoal(updated)
      setNewMilestone('')
    },
  })
  const reading = useQuery({
    queryKey: careerKeys.recommendations(user?.id, goal.id),
    queryFn: () => api.goalRecommendations(goal.id),
    enabled: showReading,
    staleTime: 10 * 60_000,
  })

  const submitMilestone = (event: FormEvent) => {
    event.preventDefault()
    if (newMilestone.trim().length >= 2) addMilestone.mutate(newMilestone.trim())
  }

  const error = update.error ?? remove.error ?? addMilestone.error

  return (
    <article
      aria-labelledby={`goal-${goal.id}`}
      className={cn(
        'rounded-lg border bg-surface p-5 sm:p-6',
        completed ? 'border-success/30' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{goalCategoryLabels[goal.category]}</Badge>
            {completed && (
              <Badge tone="neutral">
                <Check aria-hidden /> Completed
              </Badge>
            )}
            {goal.status === 'archived' && <Badge>Archived</Badge>}
          </div>
          <h3 id={`goal-${goal.id}`} className="mt-2 text-lg font-semibold text-ink">
            {goal.title}
          </h3>
          {goal.description && (
            <p className="mt-1 text-sm text-muted-foreground">{goal.description}</p>
          )}
          {goal.targetDate && (
            <p
              className={cn(
                'mt-2 flex items-center gap-1.5 text-xs',
                overdue ? 'font-medium text-danger' : 'text-muted-foreground',
              )}
            >
              <CalendarDays className="size-3.5" aria-hidden />
              {overdue ? 'Overdue · ' : 'Target · '}
              {formatDate(goal.targetDate)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <GoalFormDialog
            goal={goal}
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Edit ${goal.title}`}>
                <PencilLine aria-hidden />
              </Button>
            }
            onSubmit={(values) =>
              update.mutateAsync({
                title: values.title,
                description: values.description ?? null,
                category: values.category,
                targetDate: values.targetDate ?? null,
              })
            }
          />
          <DeleteGoalButton
            title={goal.title}
            onConfirm={() => remove.mutate()}
            busy={remove.isPending}
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {progress.total === 0
              ? 'No milestones yet'
              : `${progress.done} of ${progress.total} milestones done`}
          </span>
          <span>{progress.percent}%</span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-label={`Progress on ${goal.title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
        >
          <div
            className={cn('h-full', completed ? 'bg-success' : 'bg-primary')}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {goal.milestones.length > 0 && (
        <ul className="mt-4 space-y-1">
          {goal.milestones.map((milestone) => (
            <MilestoneRow key={milestone.id} milestone={milestone} />
          ))}
        </ul>
      )}

      {goal.status === 'active' && (
        <form onSubmit={submitMilestone} className="mt-3 flex gap-2">
          <Input
            value={newMilestone}
            onChange={(event) => setNewMilestone(event.target.value)}
            placeholder="Add a milestone"
            aria-label={`Add a milestone to ${goal.title}`}
            maxLength={160}
            className="h-9"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={newMilestone.trim().length < 2 || addMilestone.isPending}
          >
            <Plus aria-hidden /> Add
          </Button>
        </form>
      )}

      {error && (
        <FormAlert tone="error" className="mt-3">
          {error.message}
        </FormAlert>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {goal.status === 'active' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => update.mutate({ status: 'completed' })}
          >
            <Check aria-hidden /> Mark goal complete
          </Button>
        )}
        {goal.status !== 'active' && (
          <Button size="sm" variant="outline" onClick={() => update.mutate({ status: 'active' })}>
            <RotateCcw aria-hidden /> Reopen
          </Button>
        )}
        {goal.status === 'active' && (
          <Button size="sm" variant="ghost" onClick={() => update.mutate({ status: 'archived' })}>
            <Archive aria-hidden /> Archive
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          aria-expanded={showReading}
          onClick={() => setShowReading((open) => !open)}
        >
          <BookOpen aria-hidden /> Recommended reading
          <ChevronDown
            className={cn('transition-transform', showReading && 'rotate-180')}
            aria-hidden
          />
        </Button>
      </div>

      {showReading && (
        <div className="mt-3 rounded-md bg-surface-muted p-4" aria-live="polite">
          {reading.isPending ? (
            <p className="text-sm text-muted-foreground">Finding guides for this goal…</p>
          ) : reading.isError ? (
            <p className="text-sm text-danger">{reading.error.message}</p>
          ) : reading.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No EverGuide guides match this goal closely yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {reading.data.map((item) => (
                <li key={item.title}>
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.excerpt}</p>
                  <p className="mt-0.5 text-[0.7rem] text-muted-foreground/80">{item.sourceName}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const replaceGoal = useReplaceGoal()
  const toggle = useMutation({
    mutationFn: () => api.updateMilestone(milestone.id, { completed: !milestone.completedAt }),
    onSuccess: replaceGoal,
  })
  const remove = useMutation({
    mutationFn: () => api.deleteMilestone(milestone.id),
    onSuccess: replaceGoal,
  })
  const done = Boolean(milestone.completedAt)

  return (
    <li className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-muted">
      <input
        type="checkbox"
        checked={done}
        disabled={toggle.isPending}
        onChange={() => toggle.mutate()}
        aria-label={`${milestone.title}: ${done ? 'done' : 'not done'}`}
        className="size-4 shrink-0 accent-[var(--primary)]"
      />
      <span className={cn('flex-1 text-sm', done && 'text-muted-foreground line-through')}>
        {milestone.title}
      </span>
      {milestone.targetDate && (
        <span className="text-xs text-muted-foreground">{formatDate(milestone.targetDate)}</span>
      )}
      <button
        type="button"
        onClick={() => remove.mutate()}
        aria-label={`Remove milestone ${milestone.title}`}
        className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  )
}

function DeleteGoalButton({
  title,
  onConfirm,
  busy,
}: {
  title: string
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Delete ${title}`}>
          <Trash2 aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete this goal?</DialogTitle>
        <DialogDescription>
          “{title}” and its milestones will be removed permanently.
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
