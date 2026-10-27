import { goalStatuses, type Goal, type GoalStatus } from '@everguide/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Route } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/use-auth'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import { careerKeys, useGoals } from '@/hooks/use-career'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { GoalCard } from './goal-card'
import { GoalFormDialog } from './goal-form-dialog'

const statusLabels: Record<GoalStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
}

export default function RoadmapPage() {
  usePageTitle('Roadmap')
  const goals = useGoals()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [filter, setFilter] = useState<GoalStatus>('active')

  const createGoal = async (values: Parameters<typeof api.createGoal>[0]) => {
    const goal = await api.createGoal(values)
    queryClient.setQueryData<Goal[]>(careerKeys.goals(user?.id), (old) => [goal, ...(old ?? [])])
    setFilter('active')
  }

  if (goals.isPending) return <PageLoader label="Loading your roadmap…" />
  if (goals.isError) return <p className="text-danger">{goals.error.message}</p>

  const counts = Object.fromEntries(
    goalStatuses.map((s) => [s, goals.data.filter((g) => g.status === s).length]),
  )
  const visible = goals.data.filter((g) => g.status === filter)
  const newGoalButton = (
    <Button>
      <Plus aria-hidden /> New goal
    </Button>
  )

  if (goals.data.length === 0) {
    return (
      <EmptyState
        icon={Route}
        title="Start your roadmap"
        action={<GoalFormDialog trigger={newGoalButton} onSubmit={createGoal} />}
      >
        <p>
          Set a goal — a role you want, a skill to learn or a habit to build — and break it into
          milestones you can tick off.
        </p>
      </EmptyState>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Show goals"
          className="inline-flex rounded-md border border-border bg-surface p-1"
        >
          {goalStatuses.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
              className={cn(
                'rounded px-3 py-1.5 text-sm',
                filter === status
                  ? 'bg-accent-subtle font-medium text-accent-fg'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {statusLabels[status]} <span className="text-xs">({counts[status]})</span>
            </button>
          ))}
        </div>
        <GoalFormDialog trigger={newGoalButton} onSubmit={createGoal} />
      </div>

      <div className="mt-6 space-y-4">
        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong p-6 text-sm text-muted-foreground">
            No {statusLabels[filter].toLowerCase()} goals.
          </p>
        ) : (
          visible.map((goal) => <GoalCard key={goal.id} goal={goal} />)
        )}
      </div>
    </div>
  )
}
