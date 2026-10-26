import type { Budget } from '@everguide/shared'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { FinanceService } from '../src/services/finance-service.ts'
import { buildTestApp, unusedService, VALID_TOKEN } from './helpers.ts'

const auth = { Authorization: `Bearer ${VALID_TOKEN}` }
const budget: Budget = { month: '2026-10', exists: true, incomePaise: 100, items: [] }

function fakeFinance(calls: unknown[] = []): FinanceService {
  return {
    ...unusedService<FinanceService>('finance'),
    getBudget: async (_ctx, month) => ({ ...budget, month }),
    setIncome: async (_ctx, month, incomePaise) => {
      calls.push({ month, incomePaise })
      return budget
    },
    addItem: async (_ctx, month, input) => {
      calls.push({ month, input })
      return budget
    },
  }
}

describe('finance routes', () => {
  it('require a signed-in user', async () => {
    const { app } = buildTestApp({ finance: fakeFinance() })
    expect((await request(app).get('/api/v1/budgets/2026-10')).status).toBe(401)
    expect((await request(app).get('/api/v1/savings-goals')).status).toBe(401)
  })

  it('accept only real months', async () => {
    const { app } = buildTestApp({ finance: fakeFinance() })
    expect((await request(app).get('/api/v1/budgets/2026-10').set(auth)).status).toBe(200)
    for (const bad of ['2026-13', '2026-1', 'october'])
      expect((await request(app).get(`/api/v1/budgets/${bad}`).set(auth)).status).toBe(400)
  })

  it('take amounts as whole, non-negative paise', async () => {
    const calls: unknown[] = []
    const { app } = buildTestApp({ finance: fakeFinance(calls) })
    for (const incomePaise of [-1, 10.5, '500'])
      expect(
        (await request(app).put('/api/v1/budgets/2026-10').set(auth).send({ incomePaise })).status,
      ).toBe(400)
    await request(app).put('/api/v1/budgets/2026-10').set(auth).send({ incomePaise: 5_000_000 })
    expect(calls).toEqual([{ month: '2026-10', incomePaise: 5_000_000 }])
  })

  it('default planned and spent amounts to zero for new items', async () => {
    const calls: { input: object }[] = []
    const { app } = buildTestApp({ finance: fakeFinance(calls) })
    const res = await request(app)
      .post('/api/v1/budgets/2026-10/items')
      .set(auth)
      .send({ label: 'Rent', kind: 'need' })
    expect(res.status).toBe(201)
    expect(calls[0]!.input).toEqual({ label: 'Rent', kind: 'need', plannedPaise: 0, spentPaise: 0 })
    const bad = await request(app)
      .post('/api/v1/budgets/2026-10/items')
      .set(auth)
      .send({ label: 'Rent', kind: 'luxury' })
    expect(bad.status).toBe(400)
  })

  it('treat malformed ids as not found', async () => {
    const { app } = buildTestApp({ finance: fakeFinance() })
    expect((await request(app).delete('/api/v1/budget-items/nope').set(auth)).status).toBe(404)
    expect((await request(app).delete('/api/v1/savings-entries/nope').set(auth)).status).toBe(404)
  })
})
