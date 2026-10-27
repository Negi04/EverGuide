import {
  guidanceDomains,
  resourceKinds,
  resourceLevels,
  type GuidanceDomain,
  type Resource,
  type ResourceKind,
  type ResourceLevel,
} from '@everguide/shared'
import { BookmarkCheck, BookOpen, Search } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/use-auth'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { domainLabels } from '@/config/onboarding'
import { resourceKindLabels, resourceLevelLabels } from '@/config/resources'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useResourceDirectory, useSavedResources } from '@/hooks/use-resources'
import { cn } from '@/lib/utils'
import { ResourceCard } from './resource-card'

type Filters = { domain?: GuidanceDomain; kind?: ResourceKind; level?: ResourceLevel }

/** The saved list is filtered in the browser (it's small and already loaded). */
function matches(resource: Resource, q: string, filters: Filters): boolean {
  const text = `${resource.title} ${resource.summary}`.toLowerCase()
  return (
    (!q ||
      q
        .toLowerCase()
        .split(/\s+/)
        .every((word) => text.includes(word))) &&
    (!filters.domain || resource.domain === filters.domain) &&
    (!filters.kind || resource.kind === filters.kind) &&
    (!filters.level || resource.level === filters.level)
  )
}

export function ResourceLibrary({ basePath }: { basePath: string }) {
  const { status } = useAuth()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>({})
  const [savedOnly, setSavedOnly] = useState(false)
  const q = useDebouncedValue(search.trim(), 300)
  const directory = useResourceDirectory({ q: q || undefined, ...filters })
  const saved = useSavedResources()
  const signedIn = status === 'signed-in'
  const filtered = Boolean(q || filters.domain || filters.kind || filters.level)

  const showingSaved = signedIn && savedOnly
  const resources = showingSaved
    ? (saved.data ?? []).filter((r) => matches(r, q, filters))
    : (directory.data?.pages.flatMap((p) => p.resources) ?? [])
  const pending = showingSaved ? saved.isPending : directory.isPending
  const error = showingSaved ? saved.error : directory.error

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search resources"
            placeholder="Search resources"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <NativeSelect
          aria-label="Area"
          value={filters.domain ?? ''}
          onChange={(e) =>
            setFilters({ ...filters, domain: (e.target.value || undefined) as GuidanceDomain })
          }
        >
          <option value="">All areas</option>
          {guidanceDomains.map((d) => (
            <option key={d} value={d}>
              {domainLabels[d]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Type"
          value={filters.kind ?? ''}
          onChange={(e) =>
            setFilters({ ...filters, kind: (e.target.value || undefined) as ResourceKind })
          }
        >
          <option value="">All types</option>
          {resourceKinds.map((k) => (
            <option key={k} value={k}>
              {resourceKindLabels[k].label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Level"
          value={filters.level ?? ''}
          onChange={(e) =>
            setFilters({ ...filters, level: (e.target.value || undefined) as ResourceLevel })
          }
        >
          <option value="">All levels</option>
          {resourceLevels.map((l) => (
            <option key={l} value={l}>
              {resourceLevelLabels[l]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {signedIn && (
        <Button
          variant="outline"
          size="sm"
          aria-pressed={savedOnly}
          onClick={() => setSavedOnly(!savedOnly)}
          className={cn(savedOnly && 'border-primary bg-accent-subtle text-accent-fg')}
        >
          <BookmarkCheck className="size-4" aria-hidden /> Saved only
          {saved.data && ` (${saved.data.length})`}
        </Button>
      )}

      {pending ? (
        <PageLoader label="Loading resources…" />
      ) : error ? (
        <p className="text-danger">{error.message}</p>
      ) : resources.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={
            showingSaved
              ? filtered
                ? 'No saved resources match'
                : 'Nothing saved yet'
              : filtered
                ? 'No resources match'
                : 'The library is being curated'
          }
        >
          <p>
            {showingSaved
              ? 'Use Save on any resource to keep it here.'
              : filtered
                ? 'Try different words or fewer filters.'
                : 'Articles and videos will appear here as the EverGuide team publishes them.'}
          </p>
        </EmptyState>
      ) : (
        <ul
          aria-label={showingSaved ? 'Saved resources' : 'Resources'}
          aria-busy={!showingSaved && directory.isPlaceholderData}
          className={cn(
            'grid gap-4 transition-opacity md:grid-cols-2 lg:grid-cols-3',
            !showingSaved && directory.isPlaceholderData && 'opacity-60',
          )}
        >
          {resources.map((resource) => (
            <li key={resource.id}>
              <ResourceCard resource={resource} basePath={basePath} />
            </li>
          ))}
        </ul>
      )}

      {!showingSaved && directory.hasNextPage && (
        <Button
          variant="outline"
          onClick={() => void directory.fetchNextPage()}
          disabled={directory.isFetchingNextPage}
        >
          {directory.isFetchingNextPage ? 'Loading…' : 'Show more'}
        </Button>
      )}
    </div>
  )
}
