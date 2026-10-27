import type { Resource } from '@everguide/shared'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { domainLabels } from '@/config/onboarding'
import { resourceKindLabels, resourceLevelLabels } from '@/config/resources'
import { formatDuration } from '@/lib/format'
import { SaveButton } from './save-button'

export function ResourceCard({ resource, basePath }: { resource: Resource; basePath: string }) {
  const { label: kind, icon: KindIcon } = resourceKindLabels[resource.kind]
  const duration = formatDuration(resource.durationMinutes)
  return (
    <article
      aria-labelledby={`resource-${resource.id}`}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface"
    >
      {resource.image && (
        // width/height reserve the space, so the page doesn't jump as images load.
        <img
          src={resource.image.src}
          srcSet={resource.image.srcSet}
          sizes="(min-width: 1024px) 22rem, (min-width: 768px) 50vw, 100vw"
          alt={resource.image.alt}
          width={800}
          height={450}
          loading="lazy"
          decoding="async"
          className="aspect-video w-full object-cover"
        />
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <KindIcon className="size-4 text-brand-600" aria-hidden />
          {kind}
          {duration && <span aria-hidden>·</span>}
          {duration}
        </p>
        <h3 id={`resource-${resource.id}`} className="mt-2 text-base font-semibold text-ink">
          <Link
            to={`${basePath}/${resource.slug}`}
            className="hover:underline focus-visible:underline"
          >
            {resource.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {resource.summary}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">{domainLabels[resource.domain]}</Badge>
            <Badge>{resourceLevelLabels[resource.level]}</Badge>
          </div>
          <SaveButton resource={resource} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">From {resource.sourceName}</p>
      </div>
    </article>
  )
}
