import { ResourceLibrary } from '@/components/resources/resource-library'
import { usePageTitle } from '@/hooks/use-page-title'

export default function AppResourcesPage() {
  usePageTitle('Resources')
  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Resource library</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Read, watch and save for later</h1>
      <p className="mt-2 text-muted-foreground">
        Articles, videos, courses and tools picked by the EverGuide team.
      </p>
      <div className="mt-8">
        <ResourceLibrary basePath="/app/resources" />
      </div>
    </div>
  )
}
