// Plans: one place for demo prices and what each plan allows. No zod here, so
// public pages can import this (via '@everguide/shared/plans') without the
// validation library.

export type PlanId = 'free' | 'pro' | 'premium'
export const paidPlanIds = ['pro', 'premium'] as const
export type PaidPlanId = (typeof paidPlanIds)[number]

/**
 * Paid plans, bought one month at a time. These are DEMO prices: EverGuide runs
 * Razorpay in Test Mode, so checkout never charges real money. The server
 * charges from this table, never from a price sent by the browser.
 */
export const PAID_PLANS: Record<
  PaidPlanId,
  { name: string; pricePaise: number; aiMonthlyAllowance: number }
> = {
  pro: { name: 'Pro', pricePaise: 19_900, aiMonthlyAllowance: 150 },
  premium: { name: 'Premium', pricePaise: 49_900, aiMonthlyAllowance: 400 },
}

/** Higher plans win when two periods overlap. */
export const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, premium: 2 }
