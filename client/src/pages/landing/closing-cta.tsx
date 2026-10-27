import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="py-20 sm:py-24">
      <div className="container-page">
        <div className="on-ink relative overflow-hidden rounded-lg bg-brand-700 px-6 py-14 sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div
            className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full border-[40px] border-white/5"
            aria-hidden
          />
          <div className="relative max-w-xl">
            <h2 id="cta-title" className="text-3xl font-semibold text-white sm:text-4xl">
              The best time to plan your next step is today.
            </h2>
            <p className="mt-4 text-lg text-brand-100">
              Create a free account and set your first goal in a few minutes.
            </p>
          </div>
          <Button size="lg" variant="accent" className="relative mt-8 lg:mt-0" asChild>
            <Link to="/register">
              Start your journey
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
