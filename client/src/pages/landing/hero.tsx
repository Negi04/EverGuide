import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarClock,
  Compass,
  Flame,
  HeartPulse,
  LayoutDashboard,
  PiggyBank,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { useRef, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useScrollVar } from '@/hooks/use-scroll-var'

// Placed on the preview's edges, clear of its text.
const chips = [
  { icon: Sparkles, label: 'Answers with sources', place: 'left-[-6%] top-[44%]', z: '90px' },
  { icon: BadgeCheck, label: 'Verified mentors', place: 'right-[-4%] top-[-3%]', z: '120px' },
  { icon: Flame, label: 'Habit streaks', place: 'left-[4%] bottom-[2%]', z: '140px' },
  { icon: PiggyBank, label: 'Budget planner', place: 'right-[-6%] top-[52%]', z: '70px' },
]

export function Hero() {
  const stage = useRef<HTMLDivElement>(null)
  // The preview starts tilted back and straightens as it scrolls into view.
  useScrollVar(stage, '--hero-p', 0.9)

  // Gentle sideways lean that follows the mouse (mouse only, not with reduced motion).
  const lean = (event: PointerEvent<HTMLElement>) => {
    const el = stage.current
    if (!el || event.pointerType !== 'mouse') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const x = event.clientX / window.innerWidth - 0.5
    el.style.setProperty('--mx', x.toFixed(3))
  }

  return (
    <section
      aria-labelledby="hero-title"
      data-dark-hero
      onPointerMove={lean}
      className="on-ink relative isolate -mt-16 overflow-hidden bg-ink"
    >
      {/* Drifting colour light behind everything. */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="aurora-blob top-[-12rem] left-[8%] size-[34rem] bg-blue-600/35" />
        <div
          className="aurora-blob top-[6rem] right-[4%] size-[28rem] bg-sky-400/25"
          style={{ animationDelay: '-6s' }}
        />
        <div
          className="aurora-blob top-[26rem] left-[38%] size-[24rem] bg-gold-400/15"
          style={{ animationDelay: '-11s' }}
        />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_50%_30%,black,transparent_70%)]" />
      </div>

      {/* -mt-16 above slides the hero under the glass header; this padding makes up for it. */}
      <div className="container-page pt-36 pb-10 text-center sm:pt-44">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-ink-foreground backdrop-blur motion-safe:animate-fade-up">
          <span className="size-1.5 rounded-full bg-gold-400" aria-hidden />
          Guidance for a brighter tomorrow
        </p>
        <h1
          id="hero-title"
          className="mx-auto mt-7 max-w-4xl text-[2.9rem] leading-[1.02] font-semibold tracking-tight text-white motion-safe:animate-fade-up sm:text-7xl lg:text-[5.5rem]"
          style={{ animationDelay: '80ms' }}
        >
          Your next chapter{' '}
          <span className="bg-gradient-to-r from-gold-400 via-[#f7d08a] to-sky-400 bg-clip-text text-transparent">
            starts here.
          </span>
        </h1>
        <p
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted motion-safe:animate-fade-up sm:text-xl"
          style={{ animationDelay: '160ms' }}
        >
          Career planning, an AI guide that cites its sources, verified mentors, wellbeing and money
          skills, connected around your goals.
        </p>
        <div
          className="mt-10 flex flex-col justify-center gap-3 motion-safe:animate-fade-up sm:flex-row"
          style={{ animationDelay: '240ms' }}
        >
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
      </div>

      {/* 3D stage: the app preview and floating feature chips share one perspective. */}
      <div ref={stage} className="relative container-page pb-16 [perspective:1600px] sm:pb-24">
        <figure
          className="relative mx-auto max-w-5xl [transform-style:preserve-3d] [transform-origin:50%_0%] motion-safe:transition-transform motion-safe:duration-150"
          style={{
            transform:
              'rotateX(calc((1 - var(--hero-p, 1)) * 24deg)) rotateY(calc(var(--mx, 0) * 5deg)) scale(calc(0.9 + var(--hero-p, 1) * 0.1))',
          }}
        >
          <AppPreview />
          {chips.map(({ icon: Icon, label, place, z }, i) => (
            <span
              key={label}
              aria-hidden
              className={`float absolute hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-md md:inline-flex ${place}`}
              style={{ ['--z' as string]: z, animationDelay: `${i * -1.3}s` }}
            >
              <Icon className="size-4 text-gold-400" />
              {label}
            </span>
          ))}
          <figcaption className="mt-5 text-center text-xs text-ink-muted">
            Preview with example content.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

/** A compact, decorative picture of the signed-in app. All content is example text. */
function AppPreview() {
  const nav = [LayoutDashboard, Sparkles, Compass, UsersRound, HeartPulse, PiggyBank, BookOpen]
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-white/15 bg-[#0e1a3a]/80 text-left shadow-[0_40px_120px_-20px_rgb(37_99_235/0.45)] ring-1 ring-white/5 backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="ml-3 text-xs text-ink-muted">EverGuide · Dashboard</span>
      </div>
      <div className="grid grid-cols-[3.25rem_1fr]">
        <div className="flex flex-col items-center gap-4 border-r border-white/10 py-5">
          {nav.map((Icon, i) => (
            <Icon key={i} className={`size-4 ${i === 0 ? 'text-gold-400' : 'text-ink-muted'}`} />
          ))}
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-6 sm:gap-4 sm:p-6">
          <PreviewCard className="sm:col-span-4">
            <p className="text-xs text-ink-muted">Today’s focus</p>
            <p className="mt-1 font-semibold text-white">Learn SQL basics</p>
            <div className="mt-3 h-1.5 rounded-full bg-white/10">
              <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-blue-600 to-sky-400" />
            </div>
            <p className="mt-2 text-xs text-ink-muted">Milestone 2 of 5 · Roadmap</p>
          </PreviewCard>
          <PreviewCard className="sm:col-span-2">
            <p className="text-xs text-ink-muted">Walk 10 minutes</p>
            <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold text-white">
              <Flame className="size-5 text-gold-400" /> 12
            </p>
            <p className="text-xs text-ink-muted">day streak</p>
          </PreviewCard>
          <PreviewCard className="sm:col-span-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-sky-400">
              <Sparkles className="size-3.5" /> AI Guide
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-foreground">
              Start with spreadsheets and SQL, then one visualisation tool
              <sup className="ml-0.5 rounded bg-blue-600/40 px-1 text-[0.6rem] text-white">1</sup>.
              Build two small projects with data you know
              <sup className="ml-0.5 rounded bg-blue-600/40 px-1 text-[0.6rem] text-white">2</sup>.
            </p>
          </PreviewCard>
          <PreviewCard className="sm:col-span-2">
            <p className="text-xs text-ink-muted">Next session</p>
            <p className="mt-1 flex items-center gap-1.5 font-semibold text-white">
              <CalendarClock className="size-4 text-sky-400" /> Thu, 6:00 pm
            </p>
            <p className="mt-1 text-xs text-ink-muted">Verified mentor</p>
          </PreviewCard>
          <PreviewCard className="hidden sm:col-span-6 sm:block">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>October budget</span>
              <span className="text-white">₹19,999 left to plan</span>
            </div>
            <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
              <div className="w-[40%] bg-blue-600" />
              <div className="w-[12%] bg-sky-400" />
              <div className="w-[20%] bg-gold-400" />
              <div className="flex-1 bg-white/10" />
            </div>
          </PreviewCard>
        </div>
      </div>
    </div>
  )
}

function PreviewCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.04] p-4 ${className ?? ''}`}>
      {children}
    </div>
  )
}
