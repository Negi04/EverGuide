import { useParams } from 'react-router'
import { MentorProfileView } from '@/components/mentors/mentor-profile-view'

export default function AppMentorDetailPage() {
  const { mentorId = '' } = useParams()
  return <MentorProfileView mentorId={mentorId} backHref="/app/mentors" backLabel="All mentors" />
}
