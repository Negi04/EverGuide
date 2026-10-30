import { Check, CircleDashed, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { featureStatusLabel, type FeatureStatus } from '@/config/features'

const statusTone = { available: 'brand', 'in-development': 'amber', planned: 'neutral' } as const
const statusIcon = { available: Check, 'in-development': Clock, planned: CircleDashed } as const

export function StatusBadge({ status }: { status: FeatureStatus }) {
  const Icon = statusIcon[status]
  return (
    <Badge tone={statusTone[status]}>
      <Icon aria-hidden />
      {featureStatusLabel[status]}
    </Badge>
  )
}
