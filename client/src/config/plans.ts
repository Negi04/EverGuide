import { PAID_PLANS, type PlanId } from '@everguide/shared/plans'

/**
 * Plans as shown on the website. Paid prices and allowances come from the shared
 * PAID_PLANS table, the same one the server charges from. They are DEMO prices:
 * checkout runs in Razorpay Test Mode and never takes real money.
 *
 * Each plan lists only what it really changes. Today that is the monthly AI
 * allowance; every other feature is available on every plan.
 */
export type Plan = {
  id: PlanId
  name: string
  audience: string
  monthlyPriceInr: number | null
  includes: string[]
  highlighted?: boolean
}

const answers = (n: number) => `${n} AI answers a month`

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    audience: 'Start exploring with the essentials.',
    monthlyPriceInr: 0,
    includes: [
      'AI Guide with a monthly usage allowance',
      'Career roadmap, resume analysis and interview practice',
      'Wellness and financial literacy tools',
      'Browse and book verified mentors',
    ],
  },
  {
    id: 'pro',
    name: PAID_PLANS.pro.name,
    audience: 'For an active job search or career change.',
    monthlyPriceInr: PAID_PLANS.pro.pricePaise / 100,
    highlighted: true,
    includes: [
      answers(PAID_PLANS.pro.aiMonthlyAllowance),
      'Shared by the AI Guide, resume analysis and interview feedback',
      'Everything in Free',
    ],
  },
  {
    id: 'premium',
    name: PAID_PLANS.premium.name,
    audience: 'For heavy, long-term use of the AI tools.',
    monthlyPriceInr: PAID_PLANS.premium.pricePaise / 100,
    includes: [
      answers(PAID_PLANS.premium.aiMonthlyAllowance),
      'Shared by the AI Guide, resume analysis and interview feedback',
      'Everything in Free',
    ],
  },
]

export function formatPlanPrice(plan: Plan): string {
  if (plan.monthlyPriceInr === null) return 'Pricing at launch'
  if (plan.monthlyPriceInr === 0) return 'Free'
  return formatInr(plan.monthlyPriceInr * 100)
}

/** Paise as rupees for display: 19900 → "₹199", 19950 → "₹199.50". */
export function formatInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100)
}
