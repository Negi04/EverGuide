import { localDate } from '@everguide/shared'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MoneyInput } from '@/components/finance/money-input'
import { fakeApi, fakeBudget, fakeSavingsGoal } from '@/test/fake-api'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

const thisMonth = localDate('Asia/Kolkata').slice(0, 7)

describe('MoneyInput', () => {
  it('turns typed rupees into exact paise', async () => {
    const onValueChange = vi.fn()
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(
      <MoneyInput
        aria-label="Amount"
        value={0}
        onValueChange={onValueChange}
        onCommit={onCommit}
      />,
    )
    const input = screen.getByLabelText('Amount')
    await user.type(input, '1,50,000.5')
    expect(onValueChange).toHaveBeenLastCalledWith(15_000_050)
    await user.tab()
    expect(onCommit).toHaveBeenCalledWith(15_000_050)
  })

  it('flags invalid amounts and never commits them', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<MoneyInput aria-label="Amount" value={0} onCommit={onCommit} />)
    const input = screen.getByLabelText('Amount')
    await user.type(input, '12.345')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    await user.tab()
    expect(onCommit).not.toHaveBeenCalled()
  })
})

describe('budget', () => {
  it("opens this month's budget with totals and the 50/30/20 comparison", async () => {
    setSession(fakeSession())
    renderRoute('/app/finance')
    expect(await screen.findByText('Left to plan')).toBeInTheDocument()
    expect(fakeApi.getBudget).toHaveBeenCalledWith(thisMonth)
    expect(screen.getByText('₹23,000')).toBeInTheDocument() // planned: 20,000 + 3,000
    expect(screen.getByText('₹27,000')).toBeInTheDocument() // left to plan
    const comparison = screen.getByRole('region', { name: /50\/30\/20 rule of thumb/ })
    expect(within(comparison).getByRole('rowheader', { name: 'Needs' })).toBeInTheDocument()
    expect(within(comparison).getByText('₹25,000')).toBeInTheDocument() // 50% of ₹50,000
  })

  it('saves a changed amount when you leave the field', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/finance')
    const planned = await screen.findByLabelText('Planned for Rent')
    await user.clear(planned)
    await user.type(planned, '21000')
    await user.tab()
    await waitFor(() =>
      expect(fakeApi.updateBudgetItem).toHaveBeenCalledWith('item-rent', {
        plannedPaise: 2_100_000,
      }),
    )
  })

  it('adds an item to the right category', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/finance')
    await user.type(await screen.findByLabelText('New savings item'), 'SIP')
    await user.type(screen.getByLabelText('Planned amount for the new savings item'), '10000')
    await user.click(
      within(screen.getByRole('form', { name: 'Add to Savings' })).getByRole('button'),
    )
    await waitFor(() =>
      expect(fakeApi.addBudgetItem).toHaveBeenCalledWith(thisMonth, {
        label: 'SIP',
        kind: 'saving',
        plannedPaise: 1_000_000,
      }),
    )
  })

  it('offers last month’s plan for an empty month, and moves between months', async () => {
    setSession(fakeSession())
    fakeApi.getBudget.mockImplementation(async (month: string) =>
      fakeBudget(month, { exists: false, incomePaise: 0, items: [] }),
    )
    const user = userEvent.setup()
    renderRoute('/app/finance')
    await user.click(await screen.findByRole('button', { name: /use last month’s plan/i }))
    await waitFor(() => expect(fakeApi.copyPreviousBudget).toHaveBeenCalledWith(thisMonth))
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await waitFor(() => expect(fakeApi.getBudget).toHaveBeenCalledTimes(2))
    expect(fakeApi.getBudget.mock.calls[1]![0]).not.toBe(thisMonth)
  })
})

describe('savings goals', () => {
  it('shows progress and records deposits and withdrawals', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/finance/savings')
    expect(
      await screen.findByRole('progressbar', { name: 'Emergency fund progress' }),
    ).toHaveAttribute('aria-valuenow', '25')
    await user.type(screen.getByLabelText('Amount for Emergency fund'), '2500')
    await user.click(screen.getByRole('button', { name: /add savings/i }))
    await waitFor(() =>
      expect(fakeApi.addSavingsEntry).toHaveBeenCalledWith('goal-1', { amountPaise: 250_000 }),
    )
    await user.type(screen.getByLabelText('Amount for Emergency fund'), '500')
    await user.click(screen.getByRole('button', { name: /withdraw/i }))
    await waitFor(() =>
      expect(fakeApi.addSavingsEntry).toHaveBeenLastCalledWith('goal-1', { amountPaise: -50_000 }),
    )
  })

  it('suggests a monthly amount when the goal has a date', async () => {
    setSession(fakeSession())
    fakeApi.listSavingsGoals.mockResolvedValue([fakeSavingsGoal({ targetDate: '2099-01-01' })])
    renderRoute('/app/finance/savings')
    expect(await screen.findByText(/a month would get you there/i)).toBeInTheDocument()
  })

  it('needs a target of at least ₹1', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/finance/savings')
    await user.type(await screen.findByLabelText('New goal'), 'Laptop')
    await user.click(screen.getByRole('button', { name: /add goal/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least ₹1/)
    expect(fakeApi.createSavingsGoal).not.toHaveBeenCalled()
  })
})

describe('calculators', () => {
  it('show results for the example inputs (checked against independent calculations)', async () => {
    setSession(fakeSession())
    renderRoute('/app/finance/calculators')
    const sip = await screen
      .findByRole('status', { name: 'SIP result' })
      .catch(() => screen.findByLabelText('SIP result'))
    expect(sip).toHaveTextContent('₹11,61,695')
    expect(screen.getByLabelText('EMI result')).toHaveTextContent('₹10,624')
    expect(screen.getByLabelText('Compound interest result')).toHaveTextContent('₹1,41,478')
  })

  it('hide a result until the inputs make sense', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/finance/calculators')
    const sipSection = await screen.findByRole('region', { name: 'SIP calculator' })
    const rate = within(sipSection).getByLabelText('Expected return (yearly)')
    await user.clear(rate)
    await user.type(rate, '45')
    expect(within(sipSection).getByText(/use a number from 0 to 30/i)).toBeInTheDocument()
    expect(within(sipSection).getByText(/fill in all fields/i)).toBeInTheDocument()
  })
})

describe('glossary', () => {
  it('filters terms as you type', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/finance/glossary')
    await user.type(await screen.findByLabelText('Search the glossary'), 'EMI')
    expect(screen.getByText('EMI (equated monthly instalment)')).toBeInTheDocument()
    expect(screen.queryByText('Net worth')).not.toBeInTheDocument()
    expect(screen.getByText(/AI-drafted, pending expert review/)).toBeInTheDocument()
  })
})
