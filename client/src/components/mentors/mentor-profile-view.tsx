import { bookingRequestSchema, type MentorDetail, type Slot } from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, CalendarDays, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { expertiseLabels } from '@/config/mentors'
import { useMe } from '@/hooks/use-me'
import { mentorKeys, useMentor, useMentorSlots } from '@/hooks/use-mentors'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { dayKey, displayTimeZone, formatDay, formatRelative, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type Props = { mentorId: string; backHref: string; backLabel: string }

/** A verified mentor's profile with bookable times shown in the viewer's time zone. */
export function MentorProfileView({ mentorId, backHref, backLabel }: Props) {
  const mentor = useMentor(mentorId)
  usePageTitle(mentor.data?.name ?? 'Mentor')

  return (
    <div>
      <Link
        to={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> {backLabel}
      </Link>
      {mentor.isPending ? (
        <PageLoader label="Loading mentor…" />
      ) : mentor.isError ? (
        <p className="mt-6 text-danger">{mentor.error.message}</p>
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <MentorAbout mentor={mentor.data} />
          <BookingPanel mentor={mentor.data} />
        </div>
      )}
    </div>
  )
}

function MentorAbout({ mentor }: { mentor: MentorDetail }) {
  return (
    <section aria-labelledby="mentor-name">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="mentor-name" className="text-3xl font-semibold text-ink">
          {mentor.name}
        </h1>
        <Badge tone="blue">
          <BadgeCheck aria-hidden /> Verified
        </Badge>
      </div>
      <p className="mt-1 text-muted-foreground">
        {[mentor.jobTitle, mentor.company].filter(Boolean).join(' · ')}
        {mentor.jobTitle || mentor.company ? ' · ' : ''}
        {mentor.yearsExperience} years of experience
      </p>
      <p className="mt-4 text-lg text-foreground">{mentor.headline}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {mentor.expertise.map((e) => (
          <Badge key={e}>{expertiseLabels[e]}</Badge>
        ))}
      </div>
      <p className="mt-6 leading-relaxed whitespace-pre-line text-foreground">{mentor.bio}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        Languages: {mentor.languages.join(', ')} · {mentor.sessionMinutes}-minute sessions
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Verified means an EverGuide reviewer checked the evidence this mentor provided. It isn’t a
        guarantee of outcomes.
      </p>

      <h2 className="mt-10 text-lg font-semibold text-ink">Reviews</h2>
      {mentor.reviews.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No reviews yet. Only people who completed a session can review.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {mentor.reviews.map((review, i) => (
            <li key={i} className="rounded-md border border-border bg-surface p-4">
              <p
                className="flex items-center gap-1 text-sm"
                aria-label={`${review.rating} out of 5`}
              >
                {Array.from({ length: 5 }, (_, s) => (
                  <Star
                    key={s}
                    className={cn(
                      'size-4',
                      s < review.rating ? 'fill-accent text-accent' : 'text-border-strong',
                    )}
                    aria-hidden
                  />
                ))}
                <span className="ml-2 text-xs text-muted-foreground">
                  From a completed session · {formatRelative(review.createdAt)}
                </span>
              </p>
              {review.comment && <p className="mt-2 text-sm">{review.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function BookingPanel({ mentor }: { mentor: MentorDetail }) {
  const { status } = useAuth()
  const { data: me } = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const slots = useMentorSlots(mentor.id, mentor.isAccepting)
  const timeZone = displayTimeZone(me?.timezone)
  const [day, setDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [topic, setTopic] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const days = useMemo(() => {
    const groups = new Map<string, Slot[]>()
    for (const s of slots.data ?? []) {
      const key = dayKey(s.startsAt, timeZone)
      groups.set(key, [...(groups.get(key) ?? []), s])
    }
    return [...groups.entries()]
  }, [slots.data, timeZone])
  const activeDay = day ?? days[0]?.[0] ?? null
  const isSelf = me?.id === mentor.id

  const book = useMutation({
    mutationFn: () => api.requestBooking({ mentorId: mentor.id, startsAt: slot!.startsAt, topic }),
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: mentorKeys.slots(mentor.id) })
      await navigate('/app/mentors/sessions', { state: { justBooked: true } })
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: mentorKeys.slots(mentor.id) }),
  })

  const submit = () => {
    if (!slot) return setProblem('Choose a time first.')
    const checked = bookingRequestSchema.safeParse({
      mentorId: mentor.id,
      startsAt: slot.startsAt,
      topic,
    })
    if (!checked.success)
      return setProblem(checked.error.issues[0]?.message ?? 'Check your request.')
    setProblem(null)
    book.mutate()
  }

  return (
    <aside
      aria-labelledby="book-title"
      className="h-fit min-w-0 rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-6"
    >
      <h2 id="book-title" className="flex items-center gap-2 text-lg font-semibold text-ink">
        <CalendarDays className="size-5 text-blue-600" aria-hidden /> Book a session
      </h2>
      {!mentor.isAccepting ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {mentor.name.split(' ')[0]} isn’t taking new requests right now.
        </p>
      ) : slots.isPending ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading available times…</p>
      ) : days.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No open times in the next two weeks. Check back soon.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Times shown in {timeZone.replaceAll('_', ' ')}.
          </p>
          <div role="group" aria-label="Day" className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {days.map(([key, daySlots]) => (
              <button
                key={key}
                type="button"
                aria-pressed={key === activeDay}
                onClick={() => {
                  setDay(key)
                  setSlot(null)
                }}
                className={cn(
                  'shrink-0 rounded-md border px-3 py-2 text-xs whitespace-nowrap',
                  key === activeDay
                    ? 'border-primary bg-blue-50 text-blue-700'
                    : 'border-border hover:border-border-strong',
                )}
              >
                {formatDay(daySlots[0]!.startsAt, timeZone)}
              </button>
            ))}
          </div>
          <div
            role="group"
            aria-label="Time"
            className="mt-3 grid max-h-56 grid-cols-3 gap-2 overflow-y-auto"
          >
            {days
              .find(([key]) => key === activeDay)?.[1]
              .map((s) => (
                <button
                  key={s.startsAt}
                  type="button"
                  aria-pressed={slot?.startsAt === s.startsAt}
                  onClick={() => setSlot(s)}
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-xs',
                    slot?.startsAt === s.startsAt
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-primary',
                  )}
                >
                  {formatTime(s.startsAt, timeZone)}
                </button>
              ))}
          </div>

          {status !== 'signed-in' ? (
            <Button className="mt-5 w-full" asChild>
              <Link to={`/login?redirect=${encodeURIComponent(`/app/mentors/${mentor.id}`)}`}>
                Log in to book
              </Link>
            </Button>
          ) : isSelf ? (
            <p className="mt-5 text-sm text-muted-foreground">This is your own mentor profile.</p>
          ) : (
            <div className="mt-5 space-y-3">
              <label htmlFor="booking-topic" className="block text-sm font-medium">
                What would you like to discuss?
              </label>
              <Textarea
                id="booking-topic"
                rows={3}
                className="min-h-20"
                value={topic}
                maxLength={500}
                onChange={(e) => setTopic(e.target.value)}
              />
              {(problem ?? book.error?.message) && (
                <FormAlert tone="error">{problem ?? book.error?.message}</FormAlert>
              )}
              <Button className="w-full" onClick={submit} disabled={book.isPending}>
                {book.isPending ? 'Sending request…' : 'Request this time'}
              </Button>
              <p className="text-xs text-muted-foreground">
                The mentor confirms the request and adds a meeting link. Confirmed sessions can be
                cancelled up to 12 hours before they start.
              </p>
            </div>
          )}
        </>
      )}
    </aside>
  )
}
