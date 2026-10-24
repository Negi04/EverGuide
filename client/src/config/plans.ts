/**
 * Subscription plans as shown on the website. Prices and usage limits are `null`
 * until they are decided; billing itself is configured server-side with Razorpay
 * (Phase 6), and the server remains the source of truth for what a plan allows.
 */
export type Plan = {
  id: 'free' | 'pro' | 'premium'
  name: string
  audience: string
  monthlyPriceInr: number | null
  includes: string[]
  highlighted?: boolean
}

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    audience: 'Start exploring with the essentials.',
    monthlyPriceInr: 0,
    includes: [
      'AI Guide with a monthly usage allowance',
      'Career roadmap with goals and milestones',
      'Wellness and financial literacy tools',
      'Browse verified mentors',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    audience: 'For an active job search or career change.',
    monthlyPriceInr: null,
    highlighted: true,
    includes: [
      'Higher AI Guide allowance',
      'Resume analysis against job descriptions',
      'Interview practice with AI feedback',
      'Everything in Free',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    audience: 'For guided, long-term growth.',
    monthlyPriceInr: null,
    includes: [
      'Highest AI Guide allowance',
      'Priority mentor booking requests',
      'Scheduled progress summaries',
      'Everything in Pro',
    ],
  },
]

export function formatPlanPrice(plan: Plan): string {
  if (plan.monthlyPriceInr === null) return 'Pricing at launch'
  if (plan.monthlyPriceInr === 0) return 'Free'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(plan.monthlyPriceInr)
}
