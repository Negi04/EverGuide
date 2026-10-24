import { Link } from 'react-router'
import { SectionHeading } from '@/components/common/section-heading'
import { PlanList } from '@/components/pricing/plan-list'

export function PricingPreview() {
  return (
    <section aria-labelledby="pricing-title" className="border-t border-border bg-surface py-20 sm:py-28">
      <div className="container-page">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="pricing-title"
            eyebrow="Plans"
            title="Start free. Upgrade when you need more."
            lead="Paid plan prices and exact usage allowances will be published before paid plans open."
          />
          <Link to="/pricing" className="text-sm font-medium text-primary hover:underline">
            Compare plans in detail
          </Link>
        </div>
        <div className="mt-12">
          <PlanList />
        </div>
      </div>
    </section>
  )
}
