import type { AdminOverview } from '@everguide/shared'
import { useState } from 'react'
import { PageLoader } from '@/components/common/page-loader'
import { useAdminOverview } from '@/hooks/use-admin'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const nf = new Intl.NumberFormat('en-IN')

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-ink tabular-nums">{nf.format(value)}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

/** One series, so one hue and no legend; the title names it. */
function SignupsChart({ weeks }: { weeks: AdminOverview['signupsByWeek'] }) {
  const [active, setActive] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const max = Math.max(1, ...weeks.map((w) => w.signups))
  const last = weeks.length - 1

  return (
    <section
      aria-labelledby="signups-title"
      className="rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="signups-title" className="font-semibold text-ink">
          New sign-ups per week
        </h3>
        <button
          type="button"
          className="text-sm text-brand-700 underline-offset-4 hover:underline"
          aria-pressed={asTable}
          onClick={() => setAsTable(!asTable)}
        >
          {asTable ? 'Show as chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1.5 font-normal">Week starting</th>
              <th className="py-1.5 text-right font-normal">Sign-ups</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.weekStart} className="border-t border-border">
                <td className="py-1.5">{formatDate(w.weekStart)}</td>
                <td className="py-1.5 text-right tabular-nums">{nf.format(w.signups)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // Top margin leaves room for the tooltip above the tallest bar, inside the card.
        <div className="mt-12">
          {/* Recessive axis: one reference line at the maximum, labelled in muted ink. */}
          <div className="relative h-40 border-b border-border-strong">
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />
            {weeks[last]?.signups !== max && (
              <span className="absolute -top-2.5 right-0 bg-surface pl-1 text-xs text-muted-foreground tabular-nums">
                {nf.format(max)}
              </span>
            )}
            <div className="flex h-full items-end gap-0.5 pr-8">
              {weeks.map((w, i) => (
                // Hit target is the whole column, bigger than the bar itself.
                <div
                  key={w.weekStart}
                  tabIndex={0}
                  aria-label={`Week of ${formatDate(w.weekStart)}: ${w.signups} sign-ups`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="relative flex h-full flex-1 items-end outline-none focus-visible:bg-brand-50"
                >
                  <div
                    className={cn(
                      'w-full rounded-t bg-brand-600 transition-opacity',
                      active !== null && active !== i && 'opacity-50',
                    )}
                    style={{ height: `${(w.signups / max) * 100}%`, minHeight: w.signups ? 2 : 0 }}
                  />
                  {i === last && w.signups > 0 && active === null && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-foreground tabular-nums">
                      {nf.format(w.signups)}
                    </span>
                  )}
                  {active === i && (
                    <div
                      role="tooltip"
                      className={cn(
                        'pointer-events-none absolute bottom-full z-10 mb-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm',
                        i > weeks.length / 2 ? 'right-0' : 'left-0',
                      )}
                    >
                      <span className="text-muted-foreground">
                        Week of {formatDate(w.weekStart)}
                      </span>
                      <br />
                      <span className="font-semibold text-ink tabular-nums">
                        {nf.format(w.signups)}
                      </span>{' '}
                      sign-ups
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex justify-between pr-8 text-xs text-muted-foreground">
            <span>{weeks[0] && formatDate(weeks[0].weekStart)}</span>
            <span>This week</span>
          </div>
        </div>
      )}
    </section>
  )
}

export default function OverviewPage() {
  usePageTitle('Admin overview')
  const overview = useAdminOverview()
  if (overview.isPending) return <PageLoader label="Loading overview…" />
  if (overview.isError) return <p className="text-danger">{overview.error.message}</p>
  const o = overview.data
  const bookings = Object.values(o.bookings).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-ink">Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Counts only. No personal content is shown here, and journals are never included.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="People"
          value={o.users.total}
          note={`${nf.format(o.users.newLast7Days)} new this week`}
        />
        <Stat label="Finished onboarding" value={o.users.onboarded} />
        <Stat
          label="AI answers this month"
          value={o.ai.messagesThisMonth}
          note={o.ai.failedThisMonth ? `${nf.format(o.ai.failedThisMonth)} failed` : undefined}
        />
        <Stat
          label="Answers rated not helpful"
          value={o.ai.notHelpfulFeedback}
          note={`${nf.format(o.ai.helpfulFeedback)} rated helpful`}
        />
        <Stat
          label="Verified mentors"
          value={o.mentors.verified}
          note={`${nf.format(o.mentors.pending)} waiting for review`}
        />
        <Stat label="Mentor sessions" value={bookings} note="All statuses" />
        <Stat label="Published resources" value={o.content.publishedResources} />
        <Stat label="Approved knowledge documents" value={o.content.approvedKnowledgeDocuments} />
      </div>
      <SignupsChart weeks={o.signupsByWeek} />
    </div>
  )
}
