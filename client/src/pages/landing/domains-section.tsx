import { ArrowRight } from 'lucide-react'
import { Tabs } from 'radix-ui'
import { Link } from 'react-router'
import { SectionHeading } from '@/components/common/section-heading'
import { StatusBadge } from '@/components/common/status-badge'
import { domains } from '@/config/features'

/** The guidance domains as an accessible tab set instead of a repetitive card grid. */
export function DomainsSection() {
  const firstDomain = domains[0]
  if (!firstDomain) return null

  return (
    <section aria-labelledby="domains-title" className="py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          id="domains-title"
          eyebrow="One ecosystem"
          title="Every part of growing up and moving forward, in one place."
          lead="Decisions about work, wellbeing and money affect each other. EverGuide keeps them connected, so the advice you get reflects the whole picture."
        />

        <Tabs.Root
          defaultValue={firstDomain.id}
          orientation="vertical"
          className="mt-14 grid gap-8 lg:grid-cols-[18rem_1fr] lg:gap-12"
        >
          <Tabs.List
            aria-label="Guidance domains"
            className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:border-l lg:border-border lg:pb-0"
          >
            {domains.map(({ id, name, icon: Icon }) => (
              <Tabs.Trigger
                key={id}
                value={id}
                className="group flex shrink-0 items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-ink lg:-ml-px lg:rounded-none lg:border-0 lg:border-l-2 lg:border-transparent lg:bg-transparent lg:py-3.5 lg:data-[state=active]:border-primary"
              >
                <Icon className="size-4 text-blue-600" aria-hidden />
                {name}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {domains.map((domain) => (
            <Tabs.Content
              key={domain.id}
              value={domain.id}
              className="rounded-lg border border-border bg-surface p-6 shadow-md sm:p-10"
            >
              <h3 className="text-2xl font-semibold text-ink sm:text-3xl">{domain.summary}</h3>
              <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">{domain.description}</p>
              <ul className="mt-8 divide-y divide-border border-y border-border">
                {domain.capabilities.map((capability) => (
                  <li
                    key={capability.label}
                    className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm text-foreground">{capability.label}</span>
                    <StatusBadge status={capability.status} />
                  </li>
                ))}
              </ul>
              <Link
                to={`/features#${domain.id}`}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                More about {domain.name}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </div>
    </section>
  )
}
