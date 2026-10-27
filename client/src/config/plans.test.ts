import { describe, expect, it } from 'vitest'
import { PAID_PLANS } from '@everguide/shared'
import { formatInr, formatPlanPrice, plans, type Plan } from './plans'

const base: Plan = { id: 'pro', name: 'Pro', audience: '', monthlyPriceInr: null, includes: [] }

describe('formatPlanPrice', () => {
  it('does not invent a price when none is configured', () => {
    expect(formatPlanPrice(base)).toBe('Pricing at launch')
  })

  it('labels a zero price as Free', () => {
    expect(formatPlanPrice({ ...base, monthlyPriceInr: 0 })).toBe('Free')
  })

  it('formats configured prices in rupees', () => {
    expect(formatPlanPrice({ ...base, monthlyPriceInr: 499 })).toBe('₹499')
  })
})

describe('plan config', () => {
  it('never promises unlimited usage', () => {
    const text = plans.flatMap((plan) => plan.includes).join(' ')
    expect(text).not.toMatch(/unlimited/i)
  })
})

describe('demo prices', () => {
  it('show the same prices the server charges', () => {
    expect(plans.find((p) => p.id === 'pro')?.monthlyPriceInr).toBe(PAID_PLANS.pro.pricePaise / 100)
    expect(plans.find((p) => p.id === 'premium')?.monthlyPriceInr).toBe(
      PAID_PLANS.premium.pricePaise / 100,
    )
  })

  it('formats paise as rupees without floating-point surprises', () => {
    expect(formatInr(19_900)).toBe('₹199')
    expect(formatInr(19_950)).toBe('₹199.50')
  })
})
