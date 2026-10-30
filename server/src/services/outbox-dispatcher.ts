import type { Logger } from 'pino'
import type { Config } from '../config/env.ts'
import { signEvent } from '../lib/event-signing.ts'
import type { Db } from '../lib/supabase.ts'

const DELIVERY_TIMEOUT_MS = 10_000
/** How often old events are purged (see purge_outbox_events). */
const PURGE_EVERY_MS = 60 * 60 * 1000

export type OutboxDispatcher = {
  /** Deliver one batch of due events. Returns how many were delivered. */
  tick(): Promise<number>
  /** Run tick() every intervalMs until the returned function is called. */
  start(intervalMs?: number): () => void
}

/** What n8n receives for every event. */
export type EventEnvelope = {
  /** The dedupe key: the same event always has the same id, so repeats can be ignored. */
  id: string
  type: string
  occurredAt: string
  data: Record<string, unknown>
}

/**
 * Sends outbox events to n8n. The database decides what is due (claim_outbox_events)
 * and records each outcome (finish_outbox_event), including the retry backoff, so
 * this loop stays simple and several server instances can run it at once.
 */
export function createOutboxDispatcher(options: {
  admin: Db
  target: NonNullable<Config['automation']>
  logger: Logger
  fetch?: typeof fetch
  batchSize?: number
  leaseSeconds?: number
  maxAttempts?: number
  nowSeconds?: () => number
}): OutboxDispatcher {
  const { admin, target, logger } = options
  const send = options.fetch ?? fetch
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000))
  let running = false
  let lastPurge = 0

  async function deliver(event: {
    dedupe_key: string
    event_type: string
    created_at: string
    payload: unknown
  }): Promise<string | null> {
    const envelope: EventEnvelope = {
      id: event.dedupe_key,
      type: event.event_type,
      occurredAt: event.created_at,
      data: event.payload as Record<string, unknown>,
    }
    const body = JSON.stringify(envelope)
    const timestamp = nowSeconds()
    try {
      const response = await send(target.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-EverGuide-Event': envelope.type,
          'X-EverGuide-Event-Id': envelope.id,
          'X-EverGuide-Timestamp': String(timestamp),
          'X-EverGuide-Signature': signEvent(target.secret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      })
      return response.ok ? null : `n8n returned ${response.status}`
    } catch (error) {
      return error instanceof Error ? error.message : 'Delivery failed'
    }
  }

  async function tick(): Promise<number> {
    // A slow batch must not overlap the next one.
    if (running) return 0
    running = true
    try {
      // Retention: delivered and failed events don't stay forever.
      if (Date.now() - lastPurge >= PURGE_EVERY_MS) {
        lastPurge = Date.now()
        const purged = await admin.rpc('purge_outbox_events')
        if (purged.error) logger.error({ err: purged.error }, 'Could not purge old events')
      }

      // Queue reminders for sessions starting soon; they then go out like any event.
      const reminders = await admin.rpc('enqueue_due_reminders')
      if (reminders.error) logger.error({ err: reminders.error }, 'Could not queue reminders')

      const { data: events, error } = await admin.rpc('claim_outbox_events', {
        p_limit: options.batchSize ?? 20,
        p_lease_seconds: options.leaseSeconds ?? 60,
      })
      if (error) {
        logger.error({ err: error }, 'Could not claim outbox events')
        return 0
      }

      let delivered = 0
      for (const event of events) {
        const failure = await deliver(event)
        const { error: finishError } = await admin.rpc('finish_outbox_event', {
          p_id: event.id,
          p_ok: failure === null,
          p_error: failure,
          p_max_attempts: options.maxAttempts ?? 8,
        })
        if (finishError)
          logger.error({ err: finishError, eventId: event.id }, 'Could not record delivery')
        if (failure === null) delivered++
        else
          logger.warn(
            { eventType: event.event_type, attempt: event.attempts, failure },
            'Event delivery failed',
          )
      }
      return delivered
    } finally {
      running = false
    }
  }

  return {
    tick,
    start(intervalMs = 5_000) {
      const timer = setInterval(() => void tick(), intervalMs)
      timer.unref()
      void tick()
      return () => clearInterval(timer)
    },
  }
}
