import { Construction } from 'lucide-react'
import { useLocation } from 'react-router'
import { EmptyState } from '@/components/common/empty-state'

/** Honest placeholder for Career Studio tabs that are still being built. */
export default function ComingSoonTab() {
  const resume = useLocation().pathname.endsWith('/resume')
  return (
    <EmptyState
      icon={Construction}
      title={resume ? 'Resume analysis is being built' : 'Interview practice is being built'}
    >
      <p>
        {resume
          ? 'Upload a PDF resume, compare it with a job description and get specific suggestions.'
          : 'Practise behavioural and technical questions, save the ones you want to revisit and get optional AI feedback.'}{' '}
        This arrives in the current build phase.
      </p>
    </EmptyState>
  )
}
