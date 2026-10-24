import { CalendarDays, MessagesSquare, Route, Sparkles, Target } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'

export default function DashboardPage() {
  usePageTitle('Dashboard')

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Welcome to EverGuide</h1>
          <p className="mt-2 text-muted-foreground">
            Your goals, conversations and sessions will appear here as you use EverGuide.
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
        <EmptyState icon={Target} title="No goals yet" className="lg:col-span-2">
          <p>Set a goal — a role you want, a skill to learn or a habit to build — and break it into milestones.</p>
        </EmptyState>
        <section aria-labelledby="plan-title" className="rounded-lg border border-border bg-surface p-6">
          <h2 id="plan-title" className="text-lg font-semibold text-ink">
            Plan and usage
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your plan and AI usage will show here once your account is connected.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to="/pricing">View plans</Link>
          </Button>
        </section>

        <EmptyState icon={MessagesSquare} title="No conversations yet">
          <p>Your recent AI Guide conversations will be listed here.</p>
        </EmptyState>
        <EmptyState icon={CalendarDays} title="No upcoming sessions">
          <p>Sessions you book with mentors will appear here with their time in your time zone.</p>
        </EmptyState>
        <EmptyState icon={Route} title="No roadmap progress">
          <p>Completed milestones and recommended resources will show up as your roadmap grows.</p>
        </EmptyState>
      </div>
    </div>
  )
}
