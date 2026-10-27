import type { AutomationOverview, OutboxStatus } from '@everguide/shared'
import { AppError, databaseError } from '../lib/errors.ts'
import type { Db } from '../lib/supabase.ts'

const RECENT_LIMIT = 50
const STATUSES: OutboxStatus[] = ['pending', 'sending', 'sent', 'failed']

export interface AutomationService {
  overview(): Promise<AutomationOverview>
  /** Put a failed event back in the queue for another round of attempts. */
  retry(id: number): Promise<void>
}

/** The admin view of the outbox. Payloads aren't shown: type and status are enough. */
export function createAutomationService(admin: Db, configured: boolean): AutomationService {
  return {
    async overview() {
      const [recent, ...counts] = await Promise.all([
        admin
          .from('outbox_events')
          .select(
            'id, event_type, status, attempts, last_error, created_at, sent_at, next_attempt_at',
          )
          .order('id', { ascending: false })
          .limit(RECENT_LIMIT),
        ...STATUSES.map((status) =>
          admin
            .from('outbox_events')
            .select('id', { count: 'exact', head: true })
            .eq('status', status),
        ),
      ])
      if (recent.error) throw databaseError(recent.error)
      const failedCount = counts.find((c) => c.error)
      if (failedCount?.error) throw databaseError(failedCount.error)

      return {
        configured,
        counts: Object.fromEntries(STATUSES.map((s, i) => [s, counts[i]!.count ?? 0])) as Record<
          OutboxStatus,
          number
        >,
        recent: recent.data.map((e) => ({
          id: e.id,
          type: e.event_type,
          status: e.status,
          attempts: e.attempts,
          lastError: e.last_error,
          createdAt: e.created_at,
          sentAt: e.sent_at,
          nextAttemptAt: e.next_attempt_at,
        })),
      }
    },

    async retry(id) {
      const { data, error } = await admin
        .from('outbox_events')
        .update({
          status: 'pending',
          attempts: 0,
          next_attempt_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', id)
        .eq('status', 'failed')
        .select('id')
      if (error) throw databaseError(error)
      if (data.length === 0) throw new AppError(404, 'not_found', 'No failed event with that id.')
    },
  }
}
