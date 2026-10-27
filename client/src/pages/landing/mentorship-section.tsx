import { BadgeCheck, CircleX, Clock } from 'lucide-react'
import { Link } from 'react-router'
import { SectionHeading } from '@/components/common/section-heading'
import { Button } from '@/components/ui/button'

const states = [
  {
    icon: Clock,
    name: 'Pending',
    body: 'A mentor has applied. Their profile is visible to reviewers only.',
    className: 'text-amber-800 bg-amber-100',
  },
  {
    icon: BadgeCheck,
    name: 'Verified',
    body: 'A reviewer has checked their background against the evidence they provided.',
    className: 'text-brand-700 bg-brand-50',
  },
  {
    icon: CircleX,
    name: 'Rejected',
    body: 'The evidence did not support the profile. The mentor is not listed.',
    className: 'text-muted-foreground bg-surface-muted',
  },
]

export function MentorshipSection() {
  return (
    <section aria-labelledby="mentorship-title" className="py-20 sm:py-28">
      <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            id="mentorship-title"
            eyebrow="Human mentorship"
            title="Verified means reviewed — not self-declared."
            lead="Anyone can type a job title into a profile. EverGuide mentors are reviewed before they carry a Verified badge, and reviews can only come from people who completed a session."
          />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" asChild>
              <Link to="/mentors">How mentorship works</Link>
            </Button>
            <Button variant="link" asChild>
              <Link to="/contact?topic=mentorship">Apply to mentor</Link>
            </Button>
          </div>
        </div>

        <ul className="space-y-3">
          {states.map(({ icon: Icon, name, body, className }) => (
            <li key={name} className="flex gap-4 rounded-lg border border-border bg-surface p-5">
              <span
                className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md ${className}`}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-ink">{name}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
