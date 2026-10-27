import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeApi, fakeBilling } from '@/test/fake-api'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

const checkout = vi.hoisted(() => ({ payWithCheckout: vi.fn() }))
vi.mock('@/lib/razorpay-checkout', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/razorpay-checkout')>()),
  payWithCheckout: checkout.payWithCheckout,
}))

const payment = {
  razorpayOrderId: 'order_Test1',
  razorpayPaymentId: 'pay_Test1',
  razorpaySignature: 'a'.repeat(64),
}

describe('plan and billing', () => {
  it('says plainly that payments are a demo and shows the test details', async () => {
    setSession(fakeSession())
    renderRoute('/app/billing')
    expect(await screen.findByText(/no real money is charged/)).toBeInTheDocument()
    expect(await screen.findByText('4100 2800 0000 1007')).toBeInTheDocument()
    expect(screen.getByText('success@razorpay')).toBeInTheDocument()
    expect(screen.getByText('30 AI answers a month')).toBeInTheDocument()
  })

  it('pays through Checkout, then lets the server verify before showing the new plan', async () => {
    setSession(fakeSession())
    checkout.payWithCheckout.mockResolvedValue(payment)
    fakeApi.confirmPayment.mockResolvedValue(
      fakeBilling({
        plan: 'pro',
        aiMonthlyAllowance: 150,
        currentPeriodEnd: '2026-11-27T00:00:00.000Z',
      }),
    )
    const user = userEvent.setup()
    renderRoute('/app/billing')
    await user.click(await screen.findByRole('button', { name: 'Pay ₹199 (test)' }))

    expect(fakeApi.startCheckout).toHaveBeenCalledWith('pro')
    await waitFor(() => expect(fakeApi.confirmPayment).toHaveBeenCalledWith(payment))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Payment verified. You’re on Pro with 150 AI answers a month.',
    )
    expect(screen.getByText(/active until 27 Nov 2026/)).toBeInTheDocument()
  })

  it('shows the reason when the server refuses the payment', async () => {
    setSession(fakeSession())
    checkout.payWithCheckout.mockResolvedValue(payment)
    fakeApi.confirmPayment.mockRejectedValue(new Error('We couldn’t verify this payment.'))
    const user = userEvent.setup()
    renderRoute('/app/billing')
    await user.click(await screen.findByRole('button', { name: 'Pay ₹499 (test)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t verify this payment.')
  })

  it('turns the buttons off when the server has no test keys', async () => {
    setSession(fakeSession())
    fakeApi.getBilling.mockResolvedValue(fakeBilling({ paymentsEnabled: false }))
    renderRoute('/app/billing')
    expect(await screen.findByText(/aren’t set up on this server/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pay ₹199 (test)' })).toBeDisabled()
  })
})
