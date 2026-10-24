import { Link } from 'react-router'
import { PageHeader } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { domains } from '@/config/features'
import { usePageTitle } from '@/hooks/use-page-title'

export default function FeaturesPage() {
  usePageTitle('Features')

  return (
    <>
      <PageHeader
        eyebrow="Features"
        title="What EverGuide does — and what is still being built."
        lead="Every capability below carries its real status. We would rather tell you something is planned than pretend it already works."
      />

      <div className="container-page py-16 sm:py-20">
        <nav aria-label="On this page" className="mb-12 flex flex-wrap gap-2">
          {domains.map((domain) => (
            <a
              key={domain.id}
              href={`#${domain.id}`}
              className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted-foreground hover:border-border-strong hover:text-foreground"
            >
              {domain.name}
            </a>
          ))}
        </nav>

        <div className="divide-y divide-border border-y border-border">
          {domains.map(({ id, name, icon: Icon, summary, description, capabilities }) => (
            <section
              key={id}
              id={id}
              aria-labelledby={`${id}-title`}
              className="grid scroll-mt-24 gap-8 py-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16"
            >
              <div>
                <span className="inline-flex size-11 items-center justify-center rounded-md bg-ink text-sky-400">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 id={`${id}-title`} className="mt-5 text-2xl font-semibold text-ink sm:text-3xl">
                  {name}
                </h2>
                <p className="mt-3 text-lg text-foreground">{summary}</p>
              </div>
              <div>
                <p className="leading-relaxed text-muted-foreground">{description}</p>
                <ul className="mt-6 space-y-3">
                  {capabilities.map((capability) => (
                    <li
                      key={capability.label}
                      className="flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-sm">{capability.label}</span>
                      <StatusBadge status={capability.status} />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Button size="lg" asChild>
            <Link to="/register">Start your journey</Link>
          </Button>
          <Button size="lg" variant="ghost" asChild>
            <Link to="/pricing">See plans</Link>
          </Button>
        </div>
      </div>
    </>
  )
}
