import { PageHeader } from '@/components/common/page-header'
import { PlanList } from '@/components/pricing/plan-list'
import { usePageTitle } from '@/hooks/use-page-title'

const faqs = [
  {
    q: 'Is this a real payment?',
    a: 'No. EverGuide is a college project, and checkout runs in Razorpay Test Mode. You pay with Razorpay’s test card or test UPI details, no money moves, and the prices shown are for demonstration.',
  },
  {
    q: 'Is AI usage unlimited on any plan?',
    a: 'No. Every plan has a monthly allowance shared by the AI Guide, resume analysis and interview feedback, so the service stays reliable for everyone. The allowance for each paid plan is listed above.',
  },
  {
    q: 'How is a payment checked?',
    a: 'The plan is switched on only after the server verifies Razorpay’s signature for that payment. EverGuide never sees or stores card or bank details: they go straight to Razorpay.',
  },
  {
    q: 'Does a plan renew automatically?',
    a: 'No. Each purchase gives one month. Buying the same plan again adds another month after the current one ends.',
  },
]

export default function PricingPage() {
  usePageTitle('Pricing')

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Simple plans, priced up front."
        lead="Every feature is on the Free plan. Pro and Premium raise your monthly AI allowance. Paid plans are a demo: no real money is charged."
      />
      <div className="container-page py-16 sm:py-20">
        <PlanList />

        <section aria-labelledby="faq-title" className="mx-auto mt-24 max-w-3xl">
          <h2 id="faq-title" className="text-2xl font-semibold text-ink sm:text-3xl">
            Questions about plans
          </h2>
          <dl className="mt-8 divide-y divide-border border-y border-border">
            {faqs.map((faq) => (
              <div key={faq.q} className="py-6">
                <dt className="font-semibold text-ink">{faq.q}</dt>
                <dd className="mt-2 leading-relaxed text-muted-foreground">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  )
}
