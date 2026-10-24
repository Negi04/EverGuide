import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { GuidanceMap } from '@/components/brand/guidance-map'

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="on-ink relative overflow-hidden bg-ink">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]"
        aria-hidden
      />
      <div className="container-page relative grid items-center gap-12 py-20 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:py-28">
        <div className="motion-safe:animate-fade-up">
          <p className="eyebrow">Guidance for a brighter tomorrow</p>
          <h1
            id="hero-title"
            className="mt-5 text-[2.75rem] leading-[1.05] font-semibold text-white sm:text-6xl lg:text-[4.25rem]"
          >
            Your next chapter <span className="text-gold-400">starts here.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted sm:text-xl">
            Trusted guidance, personalized growth, and real human mentorship — all in one place.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" variant="accent" asChild>
              <Link to="/register">
                Start your journey
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button size="lg" variant="outline-ink" asChild>
              <Link to="/features">Explore EverGuide</Link>
            </Button>
          </div>
          <p className="mt-8 max-w-md text-sm text-ink-muted">
            Career, AI guidance with cited sources, verified mentors, wellness and money skills —
            connected around your goals.
          </p>
        </div>

        <GuidanceMap />
      </div>
    </section>
  )
}
