import { useParams } from 'react-router'
import { ResourceDetail } from '@/components/resources/resource-detail'

export default function ResourceDetailPage() {
  const { slug = '' } = useParams()
  return (
    <div className="container-page max-w-4xl py-12 sm:py-16">
      <ResourceDetail slug={slug} basePath="/resources" />
    </div>
  )
}
