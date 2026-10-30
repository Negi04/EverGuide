import {
  PAID_PLANS,
  PLAN_RANK,
  type BillingStatus,
  type CheckoutOrder,
  type PaidPlanId,
  type PaymentConfirmation,
  type PlanId,
  type Purchase,
} from '@everguide/shared'
import type { Logger } from 'pino'
import { AppError, databaseError, serviceUnavailable } from '../lib/errors.ts'
import type { PaymentGateway } from '../lib/razorpay.ts'
import type { Db } from '../lib/supabase.ts'
import type { UserContext } from './profile-service.ts'

export type WebhookResult = 'applied' | 'duplicate' | 'ignored'

export interface BillingService {
  status(ctx: UserContext): Promise<BillingStatus>
  createCheckout(ctx: UserContext, plan: PaidPlanId): Promise<CheckoutOrder>
  confirmCheckout(ctx: UserContext, input: PaymentConfirmation): Promise<BillingStatus>
  handleWebhook(input: {
    rawBody: Buffer
    signature: string | undefined
    eventId: string | undefined
  }): Promise<WebhookResult>
  /** The user's AI allowance this month, from their current plan. */
  monthlyAiLimit(userId: string): Promise<number>
}

/** The parts of a Razorpay webhook body we use; everything else is ignored. */
type WebhookBody = {
  event?: unknown
  payload?: {
    payment?: { entity?: { id?: unknown; order_id?: unknown; amount?: unknown } }
    order?: { entity?: { id?: unknown } }
  }
}

const paymentsOff = () =>
  serviceUnavailable('Demo payments aren’t set up on this server yet. Add Razorpay Test Mode keys.')
const orderNotFound = () => new AppError(404, 'not_found', 'Order not found.')
const str = (value: unknown) => (typeof value === 'string' ? value : null)

/**
 * Demo billing: one-month plan purchases through Razorpay Test Mode. Prices come
 * from PAID_PLANS on the server; a payment counts only after its signature checks
 * out, and the database grants each paid order exactly one period.
 */
export function createBillingService(
  admin: Db,
  clientFor: (accessToken: string) => Db,
  gateway: PaymentGateway | null,
  options: { freeMonthlyAiLimit: number; logger: Logger; now?: () => Date },
): BillingService {
  const now = options.now ?? (() => new Date())

  /** The plan in force now, and when it ends counting back-to-back months of it. */
  async function currentPlan(
    db: Db,
    userId: string,
  ): Promise<{ plan: PlanId; endsAt: string | null }> {
    const { data, error } = await db
      .from('plan_subscriptions')
      .select('plan, starts_at, ends_at')
      .eq('user_id', userId)
      .gt('ends_at', now().toISOString())
      .order('starts_at')
    if (error) throw databaseError(error)

    const at = now().getTime()
    const active = data.filter((p) => new Date(p.starts_at).getTime() <= at)
    if (active.length === 0) return { plan: 'free', endsAt: null }
    const best = active.reduce((a, b) => (PLAN_RANK[b.plan] > PLAN_RANK[a.plan] ? b : a))

    let endsAt = new Date(best.ends_at).getTime()
    for (const next of data) {
      const start = new Date(next.starts_at).getTime()
      const end = new Date(next.ends_at).getTime()
      if (next.plan === best.plan && start <= endsAt && end > endsAt) endsAt = end
    }
    return { plan: best.plan, endsAt: new Date(endsAt).toISOString() }
  }

  const allowance = (plan: PlanId) =>
    plan === 'free' ? options.freeMonthlyAiLimit : PAID_PLANS[plan].aiMonthlyAllowance

  async function status(ctx: UserContext): Promise<BillingStatus> {
    // The user's own client: Row Level Security limits this to their own records.
    const db = clientFor(ctx.accessToken)
    const [current, orders, periods] = await Promise.all([
      currentPlan(db, ctx.userId),
      db
        .from('billing_orders')
        .select('id, plan, amount_paise, status, created_at, paid_at')
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .limit(50),
      db.from('plan_subscriptions').select('order_id, starts_at, ends_at').limit(200),
    ])
    if (orders.error) throw databaseError(orders.error)
    if (periods.error) throw databaseError(periods.error)
    const periodByOrder = new Map(periods.data.map((p) => [p.order_id, p]))

    const purchases: Purchase[] = orders.data.map((o) => {
      const period = periodByOrder.get(o.id)
      return {
        id: o.id,
        plan: o.plan,
        amountPaise: o.amount_paise,
        status: o.status,
        createdAt: o.created_at,
        paidAt: o.paid_at,
        periodStart: period?.starts_at ?? null,
        periodEnd: period?.ends_at ?? null,
      }
    })

    return {
      plan: current.plan,
      currentPeriodEnd: current.endsAt,
      aiMonthlyAllowance: allowance(current.plan),
      paymentsEnabled: gateway !== null,
      demoMode: true,
      purchases,
    }
  }

  /** Confirm through the database; known refusals become a 409 the user can read. */
  async function confirm(orderId: string, paymentId: string, amountPaise: number | null) {
    const { error } = await admin.rpc('confirm_plan_payment', {
      p_razorpay_order_id: orderId,
      p_razorpay_payment_id: paymentId,
      p_amount_paise: amountPaise,
    })
    if (!error) return
    if (error.code === 'P0002') throw orderNotFound()
    if (error.code === 'P0001') throw new AppError(409, 'conflict', error.message)
    throw databaseError(error)
  }

  return {
    status,

    async createCheckout(ctx, plan) {
      if (!gateway) throw paymentsOff()
      const { pricePaise } = PAID_PLANS[plan]

      let order
      try {
        order = await gateway.createOrder({
          amountPaise: pricePaise,
          // Razorpay limits receipts to 40 characters.
          receipt: `eg_${Date.now().toString(36)}_${ctx.userId.slice(0, 8)}`,
          notes: { plan, user_id: ctx.userId, demo: 'true' },
        })
      } catch (cause) {
        options.logger.error({ err: cause }, 'Razorpay order creation failed')
        const error = serviceUnavailable('Couldn’t start the demo checkout. Please try again.')
        error.cause = cause
        throw error
      }

      const { error } = await admin.from('billing_orders').insert({
        user_id: ctx.userId,
        plan,
        amount_paise: pricePaise,
        razorpay_order_id: order.id,
      })
      if (error) throw databaseError(error)

      return {
        razorpayOrderId: order.id,
        keyId: gateway.keyId,
        plan,
        amountPaise: pricePaise,
        currency: 'INR',
      }
    },

    async confirmCheckout(ctx, input) {
      if (!gateway) throw paymentsOff()

      // Only the person who started the order can confirm it.
      const { data: order, error } = await admin
        .from('billing_orders')
        .select('user_id')
        .eq('razorpay_order_id', input.razorpayOrderId)
        .maybeSingle()
      if (error) throw databaseError(error)
      if (!order || order.user_id !== ctx.userId) throw orderNotFound()

      if (
        !gateway.verifyCheckout(
          input.razorpayOrderId,
          input.razorpayPaymentId,
          input.razorpaySignature,
        )
      ) {
        options.logger.warn({ orderId: input.razorpayOrderId }, 'Checkout signature mismatch')
        throw new AppError(400, 'validation_failed', 'We couldn’t verify this payment.')
      }

      await confirm(input.razorpayOrderId, input.razorpayPaymentId, null)
      return status(ctx)
    },

    async handleWebhook({ rawBody, signature, eventId }) {
      if (!gateway?.webhooksEnabled) throw serviceUnavailable('Webhooks aren’t set up.')
      if (!gateway.verifyWebhook(rawBody, signature)) {
        throw new AppError(401, 'unauthorized', 'Invalid webhook signature.')
      }
      if (!eventId || eventId.length > 100) {
        throw new AppError(400, 'validation_failed', 'Missing event id.')
      }

      let body: WebhookBody
      try {
        body = JSON.parse(rawBody.toString('utf8')) as WebhookBody
      } catch {
        throw new AppError(400, 'invalid_json', 'The webhook body isn’t valid JSON.')
      }
      const type = str(body.event)
      if (!type) throw new AppError(400, 'validation_failed', 'Missing event type.')
      const payment = body.payload?.payment?.entity
      const orderId = str(payment?.order_id) ?? str(body.payload?.order?.entity?.id)
      const amount = typeof payment?.amount === 'number' ? payment.amount : null

      const { data, error } = await admin.rpc('apply_payment_event', {
        p_event_id: eventId,
        p_event_type: type,
        p_razorpay_order_id: orderId,
        p_razorpay_payment_id: str(payment?.id),
        p_amount_paise: amount,
      })
      if (error) {
        // An order from somewhere else, or one the database refuses: retrying won't
        // help, so acknowledge it (Razorpay stops retrying) and keep a log line.
        if (error.code === 'P0001' || error.code === 'P0002') {
          options.logger.warn({ eventId, type, orderId, reason: error.message }, 'Webhook ignored')
          return 'ignored'
        }
        throw databaseError(error)
      }
      return data ? 'applied' : 'duplicate'
    },

    async monthlyAiLimit(userId) {
      return allowance((await currentPlan(admin, userId)).plan)
    },
  }
}
