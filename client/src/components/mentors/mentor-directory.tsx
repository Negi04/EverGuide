import { mentorExpertise, type MentorCard, type MentorExpertise } from '@everguide/shared'
import { BadgeCheck, Search, Star, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/input'
import { expertiseLabels } from '@/config/mentors'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useMentorDirectory } from '@/hooks/use-mentors'

/** Searchable list of verified mentors. `basePath` keeps links inside the current section. */
export function MentorDirectory({ basePath }: { basePath: string }) {
  const [expertise, setExpertise] = useState<MentorExpertise | ''>('')
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim())
  const mentors = useMentorDirectory({ expertise: expertise || undefined, q: q || undefined })

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="mentor-search" className="mb-1 block text-sm font-medium">
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="mentor-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, role or company"
              className="h-10 w-full rounded-md border border-border-strong bg-surface pr-3 pl-9 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        <div>
          <label htmlFor="mentor-expertise" className="mb-1 block text-sm font-medium">
            Expertise
          </label>
          <NativeSelect
            id="mentor-expertise"
            value={expertise}
            onChange={(e) => setExpertise(e.target.value as MentorExpertise | '')}
            className="w-56"
          >
            <option value="">All areas</option>
            {mentorExpertise.map((e) => (
              <option key={e} value={e}>
                {expertiseLabels[e]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="mt-6">
        {mentors.isPending ? (
          <PageLoader label="Loading mentors…" />
        ) : mentors.isError ? (
          <p className="text-danger">{mentors.error.message}</p>
        ) : mentors.data.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={search || expertise ? 'No mentors match' : 'No verified mentors yet'}
          >
            <p>
              {search || expertise
                ? 'Try a different search or area.'
                : 'Mentors appear here only after their background has been reviewed.'}
            </p>
            {!search && !expertise && (
              <p className="mt-2">
                Have experience to share?{' '}
                <Link to="/app/mentors/profile" className="font-medium text-blue-700 underline">
                  Apply to become a mentor
                </Link>
              </p>
            )}
          </EmptyState>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {mentors.data.map((mentor) => (
              <MentorCardItem key={mentor.id} mentor={mentor} href={`${basePath}/${mentor.id}`} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function MentorCardItem({ mentor, href }: { mentor: MentorCard; href: string }) {
  return (
    <li>
      <Link
        to={href}
        className="block h-full rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">{mentor.name}</p>
            <p className="text-sm text-muted-foreground">
              {[mentor.jobTitle, mentor.company].filter(Boolean).join(' · ') ||
                `${mentor.yearsExperience} years of experience`}
            </p>
          </div>
          <Badge tone="blue">
            <BadgeCheck aria-hidden /> Verified
          </Badge>
        </div>
        <p className="mt-3 text-sm text-foreground">{mentor.headline}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {mentor.expertise.slice(0, 3).map((e) => (
            <Badge key={e}>{expertiseLabels[e]}</Badge>
          ))}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{mentor.sessionMinutes}-minute sessions</span>
          <span>{mentor.languages.join(', ')}</span>
          {mentor.rating && (
            <span className="flex items-center gap-1">
              <Star className="size-3.5 fill-accent text-accent" aria-hidden />
              {mentor.rating.average} ({mentor.rating.count})
            </span>
          )}
          {!mentor.isAccepting && (
            <span className="font-medium text-accent-text">Not taking requests</span>
          )}
        </p>
      </Link>
    </li>
  )
}
