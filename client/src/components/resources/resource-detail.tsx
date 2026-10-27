import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { domainLabels } from '@/config/onboarding'
import { resourceKindLabels, resourceLevelLabels } from '@/config/resources'
import { usePageTitle } from '@/hooks/use-page-title'
import { useResource } from '@/hooks/use-resources'
import { ApiError } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { SaveButton } from './save-button'
import { VideoEmbed } from './video-embed'

export function ResourceDetail({ slug, basePath }: { slug: string; basePath: string }) {
  const resource = useResource(slug)
  usePageTitle(resource.data?.title ?? 'Resource')

  const back = (
    <Link
      to={basePath}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden /> All resources
    </Link>
  )

  if (resource.isPending) return <PageLoader label="Loading resource…" />
  if (resource.isError) {
    const missing = resource.error instanceof ApiError && resource.error.status === 404
    return (
      <div className="space-y-6">
        {back}
        <EmptyState icon={BookOpen} title={missing ? 'Resource not found' : 'Couldn’t load this'}>
          <p>{missing ? 'It may have been moved or taken down.' : resource.error.message}</p>
        </EmptyState>
      </div>
    )
  }

  const r = resource.data
  const { label: kind, icon: KindIcon } = resourceKindLabels[r.kind]
  const duration = formatDuration(r.durationMinutes)

  return (
    <article className="space-y-6">
      {back}
      <header>
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <KindIcon className="size-4 text-blue-600" aria-hidden />
          {kind}
          {duration && <span aria-hidden>·</span>}
          {duration}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">{r.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="blue">{domainLabels[r.domain]}</Badge>
          <Badge>{resourceLevelLabels[r.level]}</Badge>
          <span className="text-sm text-muted-foreground">From {r.sourceName}</span>
        </div>
      </header>

      {r.youtubeId ? (
        <VideoEmbed videoId={r.youtubeId} title={r.title} />
      ) : (
        r.image && (
          // The largest thing on the page, so it loads first rather than lazily.
          <img
            src={r.image.src}
            srcSet={r.image.srcSet}
            sizes="(min-width: 56rem) 56rem, 100vw"
            alt={r.image.alt}
            width={800}
            height={450}
            fetchPriority="high"
            className="aspect-video w-full rounded-lg border border-border object-cover"
          />
        )
      )}

      <p className="max-w-prose text-lg leading-relaxed text-foreground">{r.summary}</p>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <a href={r.url} target="_blank" rel="noopener noreferrer">
            {r.youtubeId ? 'Watch on YouTube' : `Open on ${r.sourceName}`}
            <ExternalLink className="size-4" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </Button>
        <SaveButton resource={r} size="md" />
      </div>
      <p className="text-xs text-muted-foreground">
        This links to content outside EverGuide. Its owner is responsible for it, and it may change.
      </p>
    </article>
  )
}
