import type { Booking, Slot } from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ExternalLink, Star } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { EmptyState } from '@/components/common/empty-state'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { bookingStatusLabels } from '@/config/mentors'
import { useMe } from '@/hooks/use-me'
import { useNow } from '@/hooks/use-now'
import { mentorKeys, useBookings, useMentorSlots } from '@/hooks/use-mentors'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { displayTimeZone, formatSession } from '@/lib/format'
import { cn } from '@/lib/utils'

const TWELVE_HOURS = 12 * 3_600_000

export default function SessionsPage() {
  usePageTitle('My sessions')
  const bookings = useBookings()
  const { data: me } = useMe()
  const timeZone = displayTimeZone(me?.timezone)
  const now = useNow()
  const location = useLocation()
  const navigate = useNavigate()
  // Shown once: the flag is dropped from history so a reload doesn't repeat a stale message.
  const [justBooked] = useState(
    () => (location.state as { justBooked?: boolean } | null)?.justBooked === true,
  )
  useEffect(() => {
    if (justBooked) void navigate(location.pathname, { replace: true, state: null })
  }, [justBooked, navigate, location.pathname])

  if (bookings.isPending) return <PageLoader label="Loading sessions…" />
  if (bookings.isError) return <p className="text-danger">{bookings.error.message}</p>

  const active = (b: Booking) =>
    (b.status === 'requested' || b.status === 'confirmed') && new Date(b.endsAt).getTime() > now
  const upcoming = bookings.data.filter(active)
  const past = bookings.data.filter((b) => !active(b)).reverse()

  return (
    <div className="space-y-10">
      {justBooked && (
        <FormAlert tone="success">
          Request sent. You’ll get a notification when the mentor confirms it.
        </FormAlert>
      )}
      <p className="text-sm text-muted-foreground">
        Times shown in {timeZone.replaceAll('_', ' ')}.
      </p>
      <section aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className="text-lg font-semibold text-ink">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No upcoming sessions" className="mt-3">
            <p>Find a mentor and request a time that suits you.</p>
          </EmptyState>
        ) : (
          <ul className="mt-3 space-y-3">
            {upcoming.map((b) => (
              <BookingCard key={b.id} booking={b} timeZone={timeZone} now={now} />
            ))}
          </ul>
        )}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="past-title">
          <h2 id="past-title" className="text-lg font-semibold text-ink">
            Past and closed
          </h2>
          <ul className="mt-3 space-y-3">
            {past.map((b) => (
              <BookingCard key={b.id} booking={b} timeZone={timeZone} now={now} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function BookingCard({
  booking,
  timeZone,
  now,
}: {
  booking: Booking
  timeZone: string
  now: number
}) {
  const startsIn = new Date(booking.startsAt).getTime() - now
  const open = booking.status === 'requested' || booking.status === 'confirmed'
  const isMentor = booking.role === 'mentor'
  const tone =
    booking.status === 'confirmed' ? 'blue' : booking.status === 'requested' ? 'gold' : 'neutral'

  return (
    <li className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">
            {formatSession(booking.startsAt, booking.endsAt, timeZone)}
          </p>
          <p className="text-sm text-muted-foreground">
            {isMentor ? 'Mentee' : 'Mentor'}: {booking.counterpart.name}
          </p>
        </div>
        <Badge tone={tone}>
          {isMentor && booking.status === 'requested'
            ? 'Needs your reply'
            : bookingStatusLabels[booking.status]}
        </Badge>
      </div>
      <p className="mt-3 text-sm">{booking.topic}</p>
      {booking.statusReason && (
        <p className="mt-2 text-sm text-muted-foreground">Reason: {booking.statusReason}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {booking.meetingUrl && booking.status === 'confirmed' && (
          <Button size="sm" asChild>
            <a href={booking.meetingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden /> Join meeting
            </a>
          </Button>
        )}
        {isMentor && booking.status === 'requested' && <RespondDialog booking={booking} />}
        {open && startsIn > 0 && (
          <CancelDialog
            booking={booking}
            disabledReason={
              !isMentor && booking.status === 'confirmed' && startsIn < TWELVE_HOURS
                ? 'Confirmed sessions can’t be cancelled less than 12 hours before they start.'
                : null
            }
          />
        )}
        {!isMentor && open && startsIn > TWELVE_HOURS && (
          <RescheduleDialog booking={booking} timeZone={timeZone} />
        )}
        {!isMentor && booking.status === 'completed' && !booking.reviewed && (
          <ReviewDialog booking={booking} />
        )}
        {!isMentor && booking.reviewed && (
          <span className="text-xs text-muted-foreground">You reviewed this session.</span>
        )}
      </div>
    </li>
  )
}

function useBookingAction<T>(run: (input: T) => Promise<void>) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mentorKeys.bookings(user?.id) })
      void queryClient.invalidateQueries({ queryKey: mentorKeys.notifications(user?.id) })
    },
  })
}

function ActionDialog({
  trigger,
  title,
  description,
  children,
}: {
  trigger: ReactNode
  title: string
  description: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="mt-5">{children(() => setOpen(false))}</div>
      </DialogContent>
    </Dialog>
  )
}

function RespondDialog({ booking }: { booking: Booking }) {
  const [meetingUrl, setMeetingUrl] = useState('')
  const [reason, setReason] = useState('')
  const action = useBookingAction((input: { accept: boolean }) =>
    api.respondToBooking(
      booking.id,
      input.accept ? { accept: true, meetingUrl: meetingUrl.trim() } : { accept: false, reason },
    ),
  )
  return (
    <ActionDialog
      trigger={<Button size="sm">Reply to request</Button>}
      title="Reply to this request"
      description={`${booking.counterpart.name} would like to discuss: ${booking.topic}`}
    >
      {(close) => (
        <div className="space-y-4">
          {action.error && <FormAlert tone="error">{action.error.message}</FormAlert>}
          <FormField
            label="Meeting link (to confirm)"
            hint="An https link, for example Google Meet or Zoom."
          >
            <Input
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/…"
            />
          </FormField>
          <Button
            className="w-full"
            disabled={action.isPending || !meetingUrl.startsWith('https://')}
            onClick={() => action.mutate({ accept: true }, { onSuccess: close })}
          >
            Confirm session
          </Button>
          <FormField label="Reason (if declining, optional)">
            <Input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <Button
            variant="outline"
            className="w-full"
            disabled={action.isPending}
            onClick={() => action.mutate({ accept: false }, { onSuccess: close })}
          >
            Decline
          </Button>
        </div>
      )}
    </ActionDialog>
  )
}

function CancelDialog({
  booking,
  disabledReason,
}: {
  booking: Booking
  disabledReason: string | null
}) {
  const [reason, setReason] = useState('')
  const action = useBookingAction(() => api.cancelBooking(booking.id, reason || undefined))
  if (disabledReason)
    return <p className="self-center text-xs text-muted-foreground">{disabledReason}</p>
  const reasonRequired = booking.role === 'mentor' && booking.status === 'confirmed'
  return (
    <ActionDialog
      trigger={
        <Button size="sm" variant="outline">
          Cancel
        </Button>
      }
      title="Cancel this session?"
      description="The other person will be notified."
    >
      {(close) => (
        <div className="space-y-4">
          {action.error && <FormAlert tone="error">{action.error.message}</FormAlert>}
          <FormField label={reasonRequired ? 'Reason (required)' : 'Reason (optional)'}>
            <Textarea
              rows={3}
              className="min-h-20"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <Button variant="ghost">Keep session</Button>
            </DialogClose>
            <Button
              className="bg-danger hover:bg-danger/90"
              disabled={action.isPending || (reasonRequired && !reason.trim())}
              onClick={() => action.mutate(undefined, { onSuccess: close })}
            >
              Cancel session
            </Button>
          </div>
        </div>
      )}
    </ActionDialog>
  )
}

function RescheduleDialog({ booking, timeZone }: { booking: Booking; timeZone: string }) {
  const [open, setOpen] = useState(false)
  const slots = useMentorSlots(booking.counterpart.id, open)
  const [startsAt, setStartsAt] = useState('')
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const action = useMutation({
    mutationFn: () => api.rescheduleBooking(booking.id, startsAt),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mentorKeys.bookings(user?.id) })
      setOpen(false)
    },
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Choose a new time</DialogTitle>
        <DialogDescription>The mentor will need to confirm the new time.</DialogDescription>
        <div className="mt-5 space-y-4">
          {action.error && <FormAlert tone="error">{action.error.message}</FormAlert>}
          <FormField label="New time">
            <NativeSelect value={startsAt} onChange={(e) => setStartsAt(e.target.value)}>
              <option value="">{slots.isPending ? 'Loading times…' : 'Select a time'}</option>
              {(slots.data ?? []).map((s: Slot) => (
                <option key={s.startsAt} value={s.startsAt}>
                  {formatSession(s.startsAt, s.endsAt, timeZone)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <Button
            className="w-full"
            disabled={!startsAt || action.isPending}
            onClick={() => action.mutate()}
          >
            Request new time
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReviewDialog({ booking }: { booking: Booking }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const action = useBookingAction(() => api.reviewBooking(booking.id, { rating, comment }))
  return (
    <ActionDialog
      trigger={
        <Button size="sm" variant="outline">
          <Star aria-hidden /> Leave a review
        </Button>
      }
      title={`Review your session with ${booking.counterpart.name}`}
      description="Reviews are public on the mentor’s profile, without your name."
    >
      {(close) => (
        <div className="space-y-4">
          {action.error && <FormAlert tone="error">{action.error.message}</FormAlert>}
          <fieldset>
            <legend className="text-sm font-medium">Rating</legend>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  aria-pressed={rating === n}
                  onClick={() => setRating(n)}
                  className="rounded p-1"
                >
                  <Star
                    className={cn(
                      'size-6',
                      n <= rating ? 'fill-accent text-accent' : 'text-border-strong',
                    )}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </fieldset>
          <FormField label="Comment (optional)">
            <Textarea
              rows={3}
              className="min-h-20"
              value={comment}
              maxLength={1000}
              onChange={(e) => setComment(e.target.value)}
            />
          </FormField>
          <Button
            className="w-full"
            disabled={rating === 0 || action.isPending}
            onClick={() => action.mutate(undefined, { onSuccess: close })}
          >
            Submit review
          </Button>
        </div>
      )}
    </ActionDialog>
  )
}
