import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeApi, fakeBooking, fakeMe, fakeMentorCard, inHours, mentorId } from '@/test/fake-api'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

describe('mentor directory and booking', () => {
  it('lists verified mentors publicly and filters by expertise', async () => {
    const user = userEvent.setup()
    renderRoute('/mentors')
    expect(await screen.findByText('Meera Iyer')).toBeInTheDocument()
    expect(screen.getAllByText('Verified').length).toBeGreaterThan(0)
    await user.selectOptions(screen.getByLabelText('Expertise'), 'design')
    await waitFor(() =>
      expect(fakeApi.listMentors).toHaveBeenLastCalledWith({ expertise: 'design', q: undefined }),
    )
  })

  it('asks signed-out visitors to log in before booking', async () => {
    renderRoute(`/mentors/${mentorId}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Meera Iyer' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /log in to book/i })).toHaveAttribute(
      'href',
      `/login?redirect=${encodeURIComponent(`/app/mentors/${mentorId}`)}`,
    )
  })

  it('books a chosen time with a topic and shows the sessions page', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    const { router } = renderRoute(`/app/mentors/${mentorId}`)
    const times = await screen.findByRole('group', { name: 'Time' })
    await user.click(within(times).getAllByRole('button')[1]!)
    await user.type(
      screen.getByLabelText(/what would you like to discuss/i),
      'Moving from support into data analysis',
    )
    await user.click(screen.getByRole('button', { name: /request this time/i }))
    expect(await screen.findByText(/request sent/i)).toBeInTheDocument()
    // The one-time flag is cleared, so reloading the page won't show the message again.
    await waitFor(() => expect(router.state.location.state).toBeNull())
    expect(screen.getByText(/request sent/i)).toBeInTheDocument()
    const call = fakeApi.requestBooking.mock.calls[0]![0] as {
      mentorId: string
      startsAt: string
      topic: string
    }
    expect(call.mentorId).toBe(mentorId)
    expect(new Date(call.startsAt).getTime()).toBeGreaterThan(Date.now() + 26 * 3_600_000)
  })

  it('requires a topic before sending a request', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute(`/app/mentors/${mentorId}`)
    const times = await screen.findByRole('group', { name: 'Time' })
    await user.click(within(times).getAllByRole('button')[0]!)
    await user.click(screen.getByRole('button', { name: /request this time/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 10 characters/i)
    expect(fakeApi.requestBooking).not.toHaveBeenCalled()
  })
})

describe('sessions', () => {
  beforeEach(() => {
    setSession(fakeSession())
  })

  it('lets a mentor confirm a request with a meeting link', async () => {
    fakeApi.listBookings.mockResolvedValue([
      fakeBooking({
        role: 'mentor',
        status: 'requested',
        meetingUrl: null,
        counterpart: { id: 'm2', name: 'Rahul' },
      }),
    ])
    const user = userEvent.setup()
    renderRoute('/app/mentors/sessions')
    expect(await screen.findByText('Needs your reply')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reply to request/i }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: /confirm session/i })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/meeting link/i), 'https://meet.example/xyz')
    await user.click(confirm)
    expect(fakeApi.respondToBooking).toHaveBeenCalledWith('booking-1', {
      accept: true,
      meetingUrl: 'https://meet.example/xyz',
    })
  })

  it('explains that confirmed sessions can’t be cancelled in the last 12 hours', async () => {
    fakeApi.listBookings.mockResolvedValue([
      fakeBooking({ startsAt: inHours(5), endsAt: inHours(5.5) }),
    ])
    renderRoute('/app/mentors/sessions')
    expect(await screen.findByText(/less than 12 hours before they start/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /join meeting/i })).toHaveAttribute(
      'href',
      'https://meet.example/abc',
    )
  })

  it('lets a mentee review a completed session', async () => {
    fakeApi.listBookings.mockResolvedValue([
      fakeBooking({ status: 'completed', startsAt: inHours(-3), endsAt: inHours(-2.5) }),
    ])
    const user = userEvent.setup()
    renderRoute('/app/mentors/sessions')
    await user.click(await screen.findByRole('button', { name: /leave a review/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '4 stars' }))
    await user.click(within(dialog).getByRole('button', { name: /submit review/i }))
    expect(fakeApi.reviewBooking).toHaveBeenCalledWith('booking-1', { rating: 4, comment: '' })
  })
})

describe('becoming a mentor', () => {
  it('submits an application and shows that it is being reviewed', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/mentors/profile')
    const nav = await screen.findByRole('navigation', { name: 'Mentorship' })
    expect(await within(nav).findByRole('link', { name: 'Become a mentor' })).toBeInTheDocument()
    await user.type(
      await screen.findByLabelText('Headline'),
      'Helping career switchers into data analysis',
    )
    await user.type(
      screen.getByLabelText('About you'),
      'I have spent seven years in retail analytics and love helping people switch careers.',
    )
    await user.click(screen.getByLabelText('Data & analytics'))
    await user.type(screen.getByLabelText('Evidence link'), 'https://www.linkedin.com/in/example')
    await user.click(screen.getByRole('button', { name: /submit application/i }))
    expect(await screen.findByRole('heading', { name: /being reviewed/i })).toBeInTheDocument()
    // Once there is a profile, the tab is no longer an invitation to apply.
    expect(within(nav).getByRole('link', { name: 'Mentor profile' })).toBeInTheDocument()
    expect(fakeApi.applyAsMentor).toHaveBeenCalledWith(
      expect.objectContaining({
        expertise: ['data_analytics'],
        evidenceUrl: 'https://www.linkedin.com/in/example',
        sessionMinutes: 30,
      }),
    )
  })
})

describe('admin verification page', () => {
  it('is hidden from users without the admin role', async () => {
    setSession(fakeSession())
    renderRoute('/app/admin/mentors')
    expect(await screen.findByRole('heading', { name: /don’t have access/i })).toBeInTheDocument()
    expect(fakeApi.listMentorApplications).not.toHaveBeenCalled()
  })

  it('lets admins verify an application with notes', async () => {
    setSession(fakeSession())
    fakeApi.getMe.mockResolvedValue(fakeMe({ roles: ['user', 'admin'] }))
    fakeApi.listMentorApplications.mockResolvedValue([
      {
        verificationId: 'v1',
        mentorId,
        name: 'Meera Iyer',
        email: 'meera@example.com',
        headline: fakeMentorCard().headline,
        bio: 'Seven years in retail analytics.',
        jobTitle: 'Senior Data Analyst',
        company: 'Acme Retail',
        yearsExperience: 7,
        expertise: ['data_analytics'],
        evidenceUrl: 'https://www.linkedin.com/in/example',
        evidenceNotes: null,
        submittedAt: new Date().toISOString(),
      },
    ])
    const user = userEvent.setup()
    renderRoute('/app/admin/mentors')
    expect(
      await screen.findByRole('link', { name: /linkedin\.com\/in\/example/i }),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText(/review notes/i), 'Checked LinkedIn.')
    await user.click(screen.getByRole('button', { name: /verify mentor/i }))
    expect(fakeApi.decideMentorApplication).toHaveBeenCalledWith('v1', {
      decision: 'verified',
      notes: 'Checked LinkedIn.',
    })
    expect(screen.getAllByRole('link', { name: 'Admin' }).length).toBeGreaterThan(0)
  })
})

describe('notifications', () => {
  it('shows the unread count and marks everything read', async () => {
    setSession(fakeSession())
    fakeApi.listNotifications.mockResolvedValue([
      {
        id: 'n1',
        type: 'booking.confirmed',
        title: 'Session confirmed',
        body: 'Your mentor confirmed your session.',
        linkPath: '/app/mentors/sessions',
        readAt: null,
        createdAt: new Date().toISOString(),
      },
    ])
    const user = userEvent.setup()
    renderRoute('/app')
    const [bell] = await screen.findAllByRole('button', { name: 'Notifications, 1 unread' })
    await user.click(bell!)
    expect(await screen.findByText('Session confirmed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /mark all read/i }))
    expect(fakeApi.markNotificationsRead).toHaveBeenCalledWith(undefined)
  })
})
