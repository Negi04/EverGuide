import { PageHeader } from '@/components/common/page-header'
import { ResourceLibrary } from '@/components/resources/resource-library'
import { usePageTitle } from '@/hooks/use-page-title'

export default function ResourcesPage() {
  usePageTitle('Resource library')

  return (
    <>
      <PageHeader
        eyebrow="Resource library"
        title="Reading and video, chosen with care."
        lead="Articles, videos, courses and tools picked by the EverGuide team. Each one links to its original source."
      />
      <div className="container-page py-12 sm:py-16">
        <ResourceLibrary basePath="/resources" />
      </div>
    </>
  )
}
