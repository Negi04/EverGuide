import { PAID_PLANS, paidPlanIds, type BillingStatus, type PaidPlanId } from '@everguide/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/use-auth'
import { FormAlert } from '@/components/common/form-alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatInr } from '@/config/plans'
import { aiKeys } from '@/hooks/use-ai'
import { useMe } from '@/hooks/use-me'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { CheckoutDismissed, payWithCheckout } from '@/lib/razorpay-checkout'

const billingKey = (userId: string | undefined) => ['billing', userId] as const

const planName = { free: 'Free', pro: 'Pro', premium: 'Premium' } as const
const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default function BillingPage() {
  usePageTitle('Plan and billing')
  const { user } = useAuth()
  const billing = useQuery({
    queryKey: billingKey(user?.id),
    queryFn: api.getBilling,
    enabled: Boolean(user),
  })

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="eyebrow">Plan and billing</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Your plan</h1>
      </header>

      <div
        role="note"
        className="flex gap-3 rounded-md border border-amber-400/40 bg-warn-bg px-4 py-3 text-sm leading-relaxed text-warn-fg"
      >
        <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong>Demo payments.</strong> Checkout runs in Razorpay Test Mode: no real money is
          charged and prices are for demonstration. Never enter your real card details here.
        </p>
      </div>

      {billing.isPending ? (
        <div className="h-48 rounded-lg bg-surface-muted motion-safe:animate-pulse" aria-hidden />
      ) : billing.isError ? (
        <FormAlert tone="error">{billing.error.message}</FormAlert>
      ) : (
        <>
          <CurrentPlan status={billing.data} />
          <BuyPlans status={billing.data} />
          <TestDetails />
          <Purchases status={billing.data} />
        </>
      )}
    </div>
  )
}

function CurrentPlan({ status }: { status: BillingStatus }) {
  return (
    <section
      aria-labelledby="current-plan"
      className="rounded-lg border border-border bg-surface p-6"
    >
      <h2 id="current-plan" className="text-sm font-medium text-muted-foreground">
        Current plan
      </h2>
      <p className="mt-2 flex flex-wrap items-center gap-3">
        <span className="text-2xl font-semibold text-ink">{planName[status.plan]}</span>
        {status.plan !== 'free' && <Badge tone="amber">Demo</Badge>}
      </p>
      <p className="mt-2 text-sm text-foreground">
        {status.aiMonthlyAllowance} AI answers a month
        {status.currentPeriodEnd && <> · active until {date(status.currentPeriodEnd)}</>}
      </p>
    </section>
  )
}

function BuyPlans({ status }: { status: BillingStatus }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: me } = useMe()
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const buy = useMutation({
    mutationFn: async (plan: PaidPlanId) => {
      const order = await api.startCheckout(plan)
      const payment = await payWithCheckout(order, {
        name: me?.fullName,
        email: me?.email ?? undefined,
      })
      // The server verifies Razorpay's signature before switching the plan on.
      return api.confirmPayment(payment)
    },
    onMutate: () => setMessage(null),
    onSuccess: (updated) => {
      queryClient.setQueryData(billingKey(user?.id), updated)
      void queryClient.invalidateQueries({ queryKey: aiKeys.usage(user?.id) })
      setMessage({
        tone: 'success',
        text: `Payment verified. You’re on ${planName[updated.plan]} with ${updated.aiMonthlyAllowance} AI answers a month.`,
      })
    },
    onError: (error) => {
      if (error instanceof CheckoutDismissed) return
      setMessage({ tone: 'error', text: error.message })
    },
  })

  return (
    <section aria-labelledby="buy-title" className="rounded-lg border border-border bg-surface p-6">
      <h2 id="buy-title" className="text-lg font-semibold text-ink">
        Buy one month
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        No automatic renewal. Buying the same plan again adds a month after the current one.
      </p>

      {!status.paymentsEnabled && (
        <FormAlert tone="error" className="mt-5">
          Demo payments aren’t set up on this server yet.
        </FormAlert>
      )}

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {paidPlanIds.map((plan) => {
          const info = PAID_PLANS[plan]
          const pending = buy.isPending && buy.variables === plan
          return (
            <li key={plan} className="flex flex-col rounded-md border border-border p-4">
              <p className="font-semibold text-ink">{info.name}</p>
              <p className="mt-1 text-sm text-foreground">
                {info.aiMonthlyAllowance} AI answers a month
              </p>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-xl font-semibold text-ink">{formatInr(info.pricePaise)}</span>
                <span className="text-sm text-muted-foreground">demo price, 1 month</span>
              </p>
              <Button
                className="mt-4"
                variant={plan === 'pro' ? 'primary' : 'outline'}
                disabled={!status.paymentsEnabled || buy.isPending}
                onClick={() => buy.mutate(plan)}
              >
                <CreditCard aria-hidden />
                {pending ? 'Waiting for payment…' : `Pay ${formatInr(info.pricePaise)} (test)`}
              </Button>
            </li>
          )
        })}
      </ul>

      {message && (
        <FormAlert tone={message.tone} className="mt-5">
          {message.text}
        </FormAlert>
      )}
    </section>
  )
}

function TestDetails() {
  return (
    <section
      aria-labelledby="test-title"
      className="rounded-lg border border-border bg-surface p-6"
    >
      <h2 id="test-title" className="text-lg font-semibold text-ink">
        Paying in Test Mode
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Use Razorpay’s published test details. They only work in Test Mode.
      </p>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Card (succeeds)</dt>
          <dd className="mt-1 font-mono text-foreground">4100 2800 0000 1007</dd>
          <dd className="mt-1 text-muted-foreground">
            Any future expiry, any CVV. On the test bank page, any OTP of 4–10 digits.
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">UPI ID</dt>
          <dd className="mt-1 font-mono text-foreground">success@razorpay</dd>
          <dd className="mt-1 text-muted-foreground">
            <span className="font-mono">failure@razorpay</span> shows a failed payment.
          </dd>
        </div>
      </dl>
    </section>
  )
}

function Purchases({ status }: { status: BillingStatus }) {
  return (
    <section
      aria-labelledby="history-title"
      className="rounded-lg border border-border bg-surface p-6"
    >
      <h2 id="history-title" className="text-lg font-semibold text-ink">
        Purchase history
      </h2>
      {status.purchases.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No purchases yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {status.purchases.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <span className="font-medium text-foreground">
                {planName[p.plan]} · {formatInr(p.amountPaise)}{' '}
                <span className="font-normal text-muted-foreground">(test payment)</span>
              </span>
              <span className="text-muted-foreground">
                {p.periodStart && p.periodEnd
                  ? `${date(p.periodStart)} – ${date(p.periodEnd)}`
                  : p.paidAt && date(p.paidAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
