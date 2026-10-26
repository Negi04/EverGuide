import { CalendarDays, MessagesSquare, PencilLine, Sparkles, Target } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { domainLabels, goalLabels } from '@/config/onboarding'
import { useConversations, useUsage } from '@/hooks/use-ai'
import { goalProgress, useGoals } from '@/hooks/use-career'
import { useMe } from '@/hooks/use-me'
import { formatRelative } from '@/lib/format'
import { usePageTitle } from '@/hooks/use-page-title'

export default function DashboardPage() {
  usePageTitle('Dashboard')
  const { data: me } = useMe()
  if (!me) return null

  const firstName = me.fullName.split(' ')[0] ?? me.fullName
  const { primaryGoals, preferredDomains, targetCareer } = me.preferences

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Welcome, {firstName}</h1>
          <p className="mt-2 text-muted-foreground">
            {targetCareer
              ? `Working towards: ${targetCareer}.`
              : 'Here’s where your guidance starts.'}
          </p>
        </div>
        <Button asChild>
          <Link to="/app/guide">
            <Sparkles aria-hidden />
            Ask the AI Guide
          </Link>
        </Button>
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <section
          aria-labelledby="focus-title"
          className="rounded-lg border border-border bg-surface p-6 lg:col-span-2"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id="focus-title" className="text-lg font-semibold text-ink">
              Your focus
            </h2>
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <PencilLine className="size-4" aria-hidden />
              Edit answers
            </Link>
          </div>
          <h3 className="mt-5 text-sm font-medium text-muted-foreground">Goals</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {primaryGoals.map((goal) => (
              <li key={goal}>
                <Badge tone="blue">{goalLabels[goal]}</Badge>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-sm font-medium text-muted-foreground">Guidance areas</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {preferredDomains.map((domain) => (
              <li key={domain}>
                <Badge>{domainLabels[domain]}</Badge>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="plan-title"
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2 id="plan-title" className="text-lg font-semibold text-ink">
            Plan and usage
          </h2>
          <p className="mt-3 font-display text-2xl font-semibold text-ink">Free</p>
          <AiUsageMeter />
          <p className="mt-3 text-sm text-muted-foreground">
            Every account is on the Free plan until paid plans launch.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to="/pricing">View plans</Link>
          </Button>
        </section>

        <RoadmapSummary />
        <RecentConversations />
        <EmptyState icon={CalendarDays} title="No upcoming sessions">
          <p>
            Sessions you book with mentors will appear here, shown in{' '}
            {me.timezone.replaceAll('_', ' ')} time.
          </p>
        </EmptyState>
      </div>
    </div>
  )
}

function AiUsageMeter() {
  const { data: usage } = useUsage()
  if (!usage) return null
  const percent =
    usage.limit === 0 ? 100 : Math.min(100, Math.round((usage.used / usage.limit) * 100))
  return (
    <div className="mt-3">
      <p className="text-sm text-foreground">
        {usage.used} of {usage.limit} AI Guide answers used this month
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-label="AI Guide answers used this month"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
      >
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function RecentConversations() {
  const conversations = useConversations()
  const recent = conversations.data?.slice(0, 3) ?? []

  if (conversations.isPending) {
    return (
      <div className="h-40 rounded-lg bg-surface-muted motion-safe:animate-pulse" aria-hidden />
    )
  }
  if (recent.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="No conversations yet"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/guide">Ask the AI Guide</Link>
          </Button>
        }
      >
        <p>Your recent AI Guide conversations will be listed here.</p>
      </EmptyState>
    )
  }
  return (
    <section
      aria-labelledby="recent-title"
      className="rounded-lg border border-border bg-surface p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-title" className="text-lg font-semibold text-ink">
          Recent conversations
        </h2>
        <Link to="/app/guide" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {recent.map((conversation) => (
          <li key={conversation.id}>
            <Link to={`/app/guide/${conversation.id}`} className="block py-3 hover:text-primary">
              <span className="block truncate text-sm font-medium">{conversation.title}</span>
              <span className="text-xs text-muted-foreground">
                {formatRelative(conversation.lastMessageAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RoadmapSummary() {
  const goals = useGoals()
  const active = goals.data?.filter((g) => g.status === 'active') ?? []

  if (goals.isPending) {
    return (
      <div className="h-40 rounded-lg bg-surface-muted motion-safe:animate-pulse" aria-hidden />
    )
  }
  if (active.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No active goals"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/career">Set a goal</Link>
          </Button>
        }
      >
        <p>Break a goal into milestones and track your progress here.</p>
      </EmptyState>
    )
  }
  return (
    <section
      aria-labelledby="roadmap-title"
      className="rounded-lg border border-border bg-surface p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="roadmap-title" className="text-lg font-semibold text-ink">
          Your goals
        </h2>
        <Link to="/app/career" className="text-sm font-medium text-primary hover:underline">
          Open roadmap
        </Link>
      </div>
      <ul className="mt-4 space-y-4">
        {active.slice(0, 3).map((goal) => {
          const progress = goalProgress(goal)
          return (
            <li key={goal.id}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate font-medium">{goal.title}</span>
                <span className="text-muted-foreground">{progress.percent}%</span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                aria-hidden
              >
                <div className="h-full bg-primary" style={{ width: `${progress.percent}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
