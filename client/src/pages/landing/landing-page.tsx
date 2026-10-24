import { usePageTitle } from '@/hooks/use-page-title'
import { ClosingCta } from './closing-cta'
import { DomainsSection } from './domains-section'
import { GroundedAiSection } from './grounded-ai-section'
import { Hero } from './hero'
import { HowItWorks } from './how-it-works'
import { MentorshipSection } from './mentorship-section'
import { PricingPreview } from './pricing-preview'
import { ProductPreview } from './product-preview'

export default function LandingPage() {
  usePageTitle()

  return (
    <>
      <Hero />
      <DomainsSection />
      <ProductPreview />
      <HowItWorks />
      <GroundedAiSection />
      <MentorshipSection />
      <PricingPreview />
      <ClosingCta />
    </>
  )
}
