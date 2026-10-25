import { useParams } from 'react-router'
import { MentorProfileView } from '@/components/mentors/mentor-profile-view'

/** Public mentor profile: anyone can read it; booking asks visitors to log in. */
export default function MentorDetailPage() {
  const { mentorId = '' } = useParams()
  return (
    <div className="container-page py-12">
      <MentorProfileView mentorId={mentorId} backHref="/mentors" backLabel="All mentors" />
    </div>
  )
}
