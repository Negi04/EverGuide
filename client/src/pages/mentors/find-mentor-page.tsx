import { MentorDirectory } from '@/components/mentors/mentor-directory'
import { usePageTitle } from '@/hooks/use-page-title'

export default function FindMentorPage() {
  usePageTitle('Find a mentor')
  return <MentorDirectory basePath="/app/mentors" />
}
