import { useParams } from 'react-router'
import { ResourceDetail } from '@/components/resources/resource-detail'

export default function AppResourceDetailPage() {
  const { slug = '' } = useParams()
  return (
    <div className="mx-auto max-w-4xl">
      <ResourceDetail slug={slug} basePath="/app/resources" />
    </div>
  )
}
