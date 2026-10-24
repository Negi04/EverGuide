import { CalendarDays, MessagesSquare, PencilLine, Sparkles, Target } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { domainLabels, goalLabels } from '@/config/onboarding'
import { useMe } from '@/hooks/use-me'
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
          <p className="mt-2 text-sm text-muted-foreground">
            Every account is on the Free plan until paid plans launch. AI usage will appear here
            when the AI Guide opens.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to="/pricing">View plans</Link>
          </Button>
        </section>

        <EmptyState icon={Target} title="No roadmap yet">
          <p>Goals with milestones and dates arrive with the Career Studio.</p>
        </EmptyState>
        <EmptyState icon={MessagesSquare} title="No conversations yet">
          <p>Your recent AI Guide conversations will be listed here.</p>
        </EmptyState>
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
