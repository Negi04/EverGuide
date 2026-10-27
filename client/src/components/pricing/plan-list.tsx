import { Check, FlaskConical } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPlanPrice, plans } from '@/config/plans'
import { cn } from '@/lib/utils'

export function PlanList() {
  const { status } = useAuth()
  const signedIn = status === 'signed-in'
  return (
    <>
      <ul className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const paid = plan.monthlyPriceInr !== null && plan.monthlyPriceInr > 0
          return (
            <li
              key={plan.id}
              className={cn(
                'flex flex-col rounded-lg border bg-surface p-6 sm:p-8',
                plan.highlighted ? 'border-primary shadow-lg' : 'border-border',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-ink">{plan.name}</h3>
                {plan.highlighted && <Badge tone="brand">For job seekers</Badge>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.audience}</p>
              <p className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-3xl font-semibold text-ink">
                  {formatPlanPrice(plan)}
                </span>
                {paid && (
                  <>
                    <span className="text-base text-muted-foreground">for 1 month</span>
                    <Badge tone="amber">Demo price</Badge>
                  </>
                )}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.includes.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent-fg" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="mt-8" variant={plan.highlighted ? 'primary' : 'outline'} asChild>
                {signedIn ? (
                  <Link to="/app/billing">
                    {plan.id === 'free' ? 'Open your dashboard' : `Try ${plan.name} (demo)`}
                  </Link>
                ) : (
                  <Link to="/register">
                    {plan.id === 'free' ? 'Start free' : `Join and try ${plan.name}`}
                  </Link>
                )}
              </Button>
            </li>
          )
        })}
      </ul>
      <p className="mt-6 flex items-start justify-center gap-2 text-center text-sm text-muted-foreground">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-accent-fg" aria-hidden />
        Demo payments: checkout runs in Razorpay Test Mode, so no real money is ever charged.
      </p>
    </>
  )
}
