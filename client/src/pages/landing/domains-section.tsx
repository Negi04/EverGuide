import { ArrowUpRight, Check } from 'lucide-react'
import { Link } from 'react-router'
import { SectionHeading } from '@/components/common/section-heading'
import { Reveal } from '@/components/motion/reveal'
import { Tilt } from '@/components/motion/tilt'
import { domains } from '@/config/features'
import { cn } from '@/lib/utils'

/** Column spans for a bento layout on large screens (six columns). */
const spans = [
  'lg:col-span-4',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-6',
]

/** The guidance areas as a bento grid of cards that lean towards the pointer. */
export function DomainsSection() {
  return (
    <section aria-labelledby="domains-title" className="py-20 sm:py-28">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            id="domains-title"
            eyebrow="One ecosystem"
            title="Every part of growing up and moving forward, in one place."
            lead="Decisions about work, wellbeing and money affect each other. EverGuide keeps them connected, so the advice you get reflects the whole picture."
          />
        </Reveal>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {domains.map((domain, index) => {
            const Icon = domain.icon
            const available = domain.capabilities.filter((c) => c.status === 'available')
            const large = index === 0
            return (
              <li key={domain.id} className={cn(spans[index], index === 0 && 'sm:col-span-2')}>
                <Reveal delay={index * 70} className="h-full">
                  <Tilt className="h-full rounded-2xl">
                    <Link
                      to={`/features#${domain.id}`}
                      className={cn(
                        'group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow [transform-style:preserve-3d] hover:shadow-lg sm:p-8',
                        large && 'bg-gradient-to-br from-surface via-surface to-brand-50',
                      )}
                    >
                      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-md [transform:translateZ(30px)]">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <h3
                        className={cn(
                          'mt-5 font-semibold text-ink',
                          large ? 'text-2xl sm:text-3xl' : 'text-xl',
                        )}
                      >
                        {domain.name}
                      </h3>
                      <p className="mt-2 leading-relaxed text-muted-foreground">{domain.summary}</p>
                      {available.length > 0 && (
                        <ul className="mt-5 space-y-1.5 text-sm text-foreground">
                          {available.slice(0, large ? 4 : 2).map((c) => (
                            <li key={c.label} className="flex items-start gap-2">
                              <Check
                                className="mt-0.5 size-4 shrink-0 text-brand-600"
                                aria-hidden
                              />
                              {c.label}
                            </li>
                          ))}
                        </ul>
                      )}
                      <span className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-medium text-primary">
                        Explore
                        <ArrowUpRight
                          className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          aria-hidden
                        />
                      </span>
                    </Link>
                  </Tilt>
                </Reveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
