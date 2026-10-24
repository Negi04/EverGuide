import { Check } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPlanPrice, plans } from '@/config/plans'
import { cn } from '@/lib/utils'

export function PlanList() {
  return (
    <ul className="grid gap-4 lg:grid-cols-3">
      {plans.map((plan) => (
        <li
          key={plan.id}
          className={cn(
            'flex flex-col rounded-lg border bg-surface p-6 sm:p-8',
            plan.highlighted ? 'border-primary shadow-lg' : 'border-border',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-ink">{plan.name}</h3>
            {plan.highlighted && <Badge tone="blue">For job seekers</Badge>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{plan.audience}</p>
          <p className="mt-6 font-display text-3xl font-semibold text-ink">
            {formatPlanPrice(plan)}
            {plan.monthlyPriceInr !== null && plan.monthlyPriceInr > 0 && (
              <span className="text-base font-normal text-muted-foreground"> / month</span>
            )}
          </p>
          <ul className="mt-6 flex-1 space-y-3">
            {plan.includes.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <Button className="mt-8" variant={plan.highlighted ? 'primary' : 'outline'} asChild>
            <Link to="/register">
              {plan.id === 'free' ? 'Start free' : `Join with ${plan.name}`}
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  )
}
