import { PageHeader } from '@/components/common/page-header'
import { PlanList } from '@/components/pricing/plan-list'
import { usePageTitle } from '@/hooks/use-page-title'

const faqs = [
  {
    q: 'When will paid plan prices be announced?',
    a: 'Before paid plans open. Until then, everything you can use is on the Free plan.',
  },
  {
    q: 'Is AI usage unlimited on any plan?',
    a: 'No. Every plan has a monthly allowance for the AI Guide so the service stays reliable for everyone. Allowances will be listed here with the prices.',
  },
  {
    q: 'How are payments handled?',
    a: 'Subscriptions will be processed by Razorpay. EverGuide does not store your card or bank details, and a paid plan is only activated after the payment provider confirms it.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes. Cancelling stops the next renewal, and you keep paid features until the end of the period you paid for.',
  },
]

export default function PricingPage() {
  usePageTitle('Pricing')

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Simple plans, published before you pay."
        lead="The Free plan covers the essentials. Pro and Premium add capacity and tools for an active job search or long-term growth."
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
