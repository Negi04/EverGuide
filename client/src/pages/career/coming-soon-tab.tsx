import { Construction } from 'lucide-react'
import { EmptyState } from '@/components/common/empty-state'

/** Honest placeholder while resume analysis is being built. */
export default function ComingSoonTab() {
  return (
    <EmptyState icon={Construction} title="Resume analysis is being built">
      <p>
        Upload a PDF resume, compare it with a job description and get specific suggestions. This
        arrives in the current build phase.
      </p>
    </EmptyState>
  )
}
