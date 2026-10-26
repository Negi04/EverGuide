import { BadgeCheck, CalendarCheck, MessageSquareText } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/common/page-header'
import { MentorDirectory } from '@/components/mentors/mentor-directory'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'

const principles = [
  {
    icon: BadgeCheck,
    title: 'Reviewed before Verified',
    body: 'Mentors submit evidence of their experience. A reviewer checks it before the Verified badge appears. A company name on a profile is not enough.',
  },
  {
    icon: CalendarCheck,
    title: 'Clear booking rules',
    body: 'Sessions are booked against the mentor’s published availability, shown in your time zone, with the same cancellation rules for everyone.',
  },
  {
    icon: MessageSquareText,
    title: 'Reviews from real sessions',
    body: 'Only people who completed a session with a mentor can review them, so ratings reflect actual experience.',
  },
]

export default function MentorsPage() {
  usePageTitle('Mentors')

  return (
    <>
      <PageHeader
        eyebrow="Mentorship"
        title="Learn from people a few steps ahead of you."
        lead="Find mentors by expertise, role and availability, and book time to talk through decisions that are hard to make alone."
      />

      <div className="container-page space-y-20 py-16 sm:py-20">
        <section aria-label="Mentor directory">
          <MentorDirectory basePath="/mentors" />
        </section>

        <section aria-labelledby="principles-title">
          <h2 id="principles-title" className="text-2xl font-semibold text-ink sm:text-3xl">
            How mentorship works on EverGuide
          </h2>
          <ul className="mt-10 grid gap-10 md:grid-cols-3">
            {principles.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon className="size-6 text-blue-600" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="apply-title"
          className="on-ink flex flex-col gap-6 rounded-lg bg-ink p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="max-w-xl">
            <p className="eyebrow">For experienced professionals</p>
            <h2 id="apply-title" className="mt-3 text-2xl font-semibold text-white">
              Share what you have learned.
            </h2>
            <p className="mt-3 text-ink-muted">
              Tell us about your background and the people you would like to help. We will explain
              the review process and what we ask for.
            </p>
          </div>
          <Button variant="accent" size="lg" asChild>
            <Link to="/app/mentors/profile">Apply to mentor</Link>
          </Button>
        </section>
      </div>
    </>
  )
}
