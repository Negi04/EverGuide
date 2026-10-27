import { describe, expect, it } from 'vitest'
import {
  budgetSummary,
  compoundInterest,
  loanEmi,
  paiseToInput,
  parseRupees,
  savingsEntrySchema,
  sipFutureValue,
} from './finance.ts'

describe('parseRupees', () => {
  it('reads amounts the way people type them', () => {
    expect(parseRupees('1,50,000')).toBe(15_000_000)
    expect(parseRupees('₹ 2500.5')).toBe(250_050)
    expect(parseRupees('99.99')).toBe(9_999)
    expect(parseRupees('0')).toBe(0)
  })

  it('is exact where floating point is not (0.1 + 0.2 problem)', () => {
    // 1.15 * 100 is 114.99999999999999 in floating point; parsing the text avoids it.
    expect(parseRupees('1.15')).toBe(115)
    expect(parseRupees('4.35')).toBe(435)
  })

  it('rejects anything that is not a plain amount', () => {
    for (const bad of ['', '-5', '1.234', 'abc', '1e5', '12.3.4', '999999999999999'])
      expect(parseRupees(bad)).toBeNull()
  })

  it('round-trips with paiseToInput', () => {
    expect(paiseToInput(150_050)).toBe('1500.50')
    expect(paiseToInput(150_000)).toBe('1500')
    expect(parseRupees(paiseToInput(123_405))).toBe(123_405)
  })
})

describe('budgetSummary', () => {
  it('totals by kind and compares with the 50/30/20 rule of thumb', () => {
    const summary = budgetSummary(5_000_000, [
      { id: '1', label: 'Rent', kind: 'need', plannedPaise: 2_000_000, spentPaise: 2_000_000 },
      { id: '2', label: 'Groceries', kind: 'need', plannedPaise: 600_000, spentPaise: 450_000 },
      { id: '3', label: 'Eating out', kind: 'want', plannedPaise: 300_000, spentPaise: 380_000 },
      { id: '4', label: 'SIP', kind: 'saving', plannedPaise: 1_000_000, spentPaise: 1_000_000 },
    ])
    expect(summary.planned).toEqual({ need: 2_600_000, want: 300_000, saving: 1_000_000 })
    expect(summary.totalSpent).toBe(3_830_000)
    expect(summary.unplanned).toBe(1_100_000)
    expect(summary.guideline).toEqual({ need: 2_500_000, want: 1_500_000, saving: 1_000_000 })
  })

  it('shows overspending as negative unplanned money', () => {
    const summary = budgetSummary(100_000, [
      { id: '1', label: 'Rent', kind: 'need', plannedPaise: 150_000, spentPaise: 0 },
    ])
    expect(summary.unplanned).toBe(-50_000)
  })
})

// Reference values computed independently (Python) and matching common public calculators.
describe('calculators', () => {
  it('SIP: ₹10,000 a month at 12% for 10 years', () => {
    const r = sipFutureValue(10_000, 12, 10)
    expect(r.invested).toBe(1_200_000)
    expect(r.value).toBeCloseTo(2_323_390.76, 1)
    expect(r.gains).toBeCloseTo(1_123_390.76, 1)
  })

  it('EMI: ₹10,00,000 at 9% for 20 years', () => {
    const r = loanEmi(1_000_000, 9, 240)
    expect(r.emi).toBeCloseTo(8_997.26, 2)
    expect(r.totalInterest).toBeCloseTo(1_159_342.29, 0)
  })

  it('EMI and SIP at 0% interest do not divide by zero', () => {
    expect(loanEmi(120_000, 0, 12).emi).toBe(10_000)
    expect(sipFutureValue(1_000, 0, 1).value).toBe(12_000)
  })

  it('compound interest: ₹1,00,000 at 8% for 5 years', () => {
    expect(compoundInterest(100_000, 8, 5, 1).amount).toBeCloseTo(146_932.81, 2)
    expect(compoundInterest(100_000, 8, 5, 12).amount).toBeCloseTo(148_984.57, 2)
  })
})

describe('savings entries', () => {
  it('accept deposits and withdrawals, not zero', () => {
    expect(savingsEntrySchema.safeParse({ amountPaise: 500 }).success).toBe(true)
    expect(savingsEntrySchema.safeParse({ amountPaise: -500 }).success).toBe(true)
    expect(savingsEntrySchema.safeParse({ amountPaise: 0 }).success).toBe(false)
    expect(savingsEntrySchema.safeParse({ amountPaise: 1.5 }).success).toBe(false)
  })
})
