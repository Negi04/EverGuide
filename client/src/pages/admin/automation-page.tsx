import type { OutboxEventSummary, OutboxStatus } from '@everguide/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, Clock, Send, Workflow } from 'lucide-react'
import { EmptyState } from '@/components/common/empty-state'
import { Notice } from '@/components/common/notice'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/auth/use-auth'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'

const statusInfo: Record<
  OutboxStatus,
  { label: string; tone: 'brand' | 'amber' | 'neutral'; icon: typeof Clock }
> = {
  pending: { label: 'Waiting', tone: 'neutral', icon: Clock },
  sending: { label: 'Sending', tone: 'neutral', icon: Send },
  sent: { label: 'Delivered', tone: 'brand', icon: CircleCheck },
  failed: { label: 'Failed', tone: 'amber', icon: CircleAlert },
}

/** Plain-language names for event types. */
const eventLabel: Record<string, string> = {
  'user.welcome': 'Welcome email',
  'booking.requested': 'Session requested',
  'booking.confirmed': 'Session confirmed',
  'booking.declined': 'Session declined',
  'booking.cancelled': 'Session cancelled',
  'booking.rescheduled': 'Session moved',
  'booking.reminder': 'Session reminder',
  'payment.succeeded': 'Payment receipt (demo)',
  'admin.mentor_application': 'New mentor application',
}

export default function AutomationPage() {
  usePageTitle('Automation')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = ['admin-automation', user?.id] as const
  const automation = useQuery({
    queryKey: key,
    queryFn: api.adminAutomation,
    // Watch events move through the queue during a demo.
    refetchInterval: 5_000,
  })
  const retry = useMutation({
    mutationFn: (id: number) => api.adminRetryEvent(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Automation</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Events EverGuide sends to n8n, which turns them into emails. Each one is signed, sent at
          least once and retried with growing gaps if n8n doesn’t answer. Events carry ids, first
          names and times only.
        </p>
      </div>

      {automation.isPending ? (
        <PageLoader label="Loading events…" />
      ) : automation.isError ? (
        <p className="text-danger">{automation.error.message}</p>
      ) : (
        <>
          {!automation.data.configured && (
            <Notice>
              n8n isn’t connected to this server yet, so events wait here. Set N8N_WEBHOOK_URL and
              N8N_WEBHOOK_SECRET and they’ll be sent.
            </Notice>
          )}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(statusInfo) as OutboxStatus[]).map((status) => (
              <div key={status} className="rounded-lg border border-border bg-surface p-4">
                <dt className="text-sm text-muted-foreground">{statusInfo[status].label}</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink">
                  {automation.data.counts[status]}
                </dd>
              </div>
            ))}
          </dl>
          {automation.data.recent.length === 0 ? (
            <EmptyState icon={Workflow} title="No events yet">
              <p>Sign-ups, bookings and demo payments create events here.</p>
            </EmptyState>
          ) : (
            <ul
              aria-label="Recent events"
              className="divide-y divide-border rounded-lg border border-border bg-surface"
            >
              {automation.data.recent.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  retrying={retry.isPending && retry.variables === event.id}
                  onRetry={() => retry.mutate(event.id)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function EventRow({
  event,
  retrying,
  onRetry,
}: {
  event: OutboxEventSummary
  retrying: boolean
  onRetry: () => void
}) {
  const { label, tone, icon: Icon } = statusInfo[event.status]
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{eventLabel[event.type] ?? event.type}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatRelative(event.createdAt)}
          {event.attempts > 0 &&
            ` · ${event.attempts} ${event.attempts === 1 ? 'attempt' : 'attempts'}`}
          {event.lastError && ` · last error: ${event.lastError}`}
        </p>
      </div>
      <Badge tone={tone}>
        <Icon aria-hidden /> {label}
      </Badge>
      {event.status === 'failed' && (
        <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
          {retrying ? 'Retrying…' : 'Retry'}
        </Button>
      )}
    </li>
  )
}
