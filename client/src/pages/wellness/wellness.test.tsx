import { localDate } from '@everguide/shared'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { breathingPatterns } from '@/config/wellness'
import { breathingStep } from '@/lib/breathing'
import { fakeApi, fakeHabit, wellnessToday } from '@/test/fake-api'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'
import BreathingPage from './breathing-page'

describe('breathing', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('works out the step and seconds left at any moment', () => {
    const box = breathingPatterns.find((p) => p.id === 'box')!
    expect(breathingStep(box, 0)).toMatchObject({ phase: { label: 'Breathe in' }, remaining: 4 })
    expect(breathingStep(box, 5)).toMatchObject({ phase: { label: 'Hold' }, remaining: 3 })
    expect(breathingStep(box, 9)).toMatchObject({ phase: { label: 'Breathe out' }, remaining: 3 })
    expect(breathingStep(box, 16)).toMatchObject({ phase: { label: 'Breathe in' }, remaining: 4 })
  })

  it('guides each step, announcing step changes, and stops at the end', () => {
    vi.useFakeTimers()
    render(<BreathingPage />)
    act(() => screen.getByRole('button', { name: /start/i }).click())
    const announcer = screen.getByText('Breathe in')
    expect(announcer).toHaveAttribute('aria-live', 'polite')
    act(() => vi.advanceTimersByTime(4000))
    expect(announcer).toHaveTextContent('Hold')
    act(() => vi.advanceTimersByTime(56_000))
    expect(announcer).toHaveTextContent(/well done/i)
    // The clock has stopped: nothing changes after the session ends.
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.getByText('1:00 / 1:00')).toBeInTheDocument()
  })

  it('switches the animation off when the device asks for reduced motion', () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('reduce'),
    })) as typeof window.matchMedia
    try {
      render(<BreathingPage />)
      expect(screen.getByText(/animation is off/i)).toBeInTheDocument()
    } finally {
      window.matchMedia = original
    }
  })
})

describe('journal', () => {
  it('shows entries and explains who can read them', async () => {
    setSession(fakeSession())
    renderRoute('/app/wellness/journal')
    expect(await screen.findByText('A good walk')).toBeInTheDocument()
    expect(screen.getByText('Mood: Good')).toBeInTheDocument()
    expect(screen.getByText(/only you can read your journal/i)).toBeInTheDocument()
  })

  it("writes an entry dated today in the person's time zone", async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/wellness/journal')
    await user.click(await screen.findByRole('button', { name: /new entry/i }))
    const form = screen.getByRole('form', { name: 'New journal entry' })
    await user.click(within(form).getByRole('button', { name: /okay/i }))
    await user.type(within(form).getByLabelText('Entry'), 'Prepared for the interview.')
    await user.click(within(form).getByRole('button', { name: /save entry/i }))
    await waitFor(() => expect(fakeApi.createJournalEntry).toHaveBeenCalled())
    expect(fakeApi.createJournalEntry).toHaveBeenCalledWith({
      entryDate: localDate('Asia/Kolkata'),
      mood: 3,
      title: '',
      body: 'Prepared for the interview.',
    })
  })

  it("won't save an empty entry", async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/wellness/journal')
    await user.click(await screen.findByRole('button', { name: /new entry/i }))
    await user.click(screen.getByRole('button', { name: /save entry/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/write something/i)
    expect(fakeApi.createJournalEntry).not.toHaveBeenCalled()
  })

  it('gently points to support after a very low mood entry', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/wellness/journal')
    await user.click(await screen.findByRole('button', { name: /new entry/i }))
    await user.click(screen.getByRole('button', { name: /very low/i }))
    await user.type(screen.getByLabelText('Entry'), 'A hard day.')
    await user.click(screen.getByRole('button', { name: /save entry/i }))
    expect(await screen.findByRole('link', { name: /see support options/i })).toHaveAttribute(
      'href',
      '/app/wellness/support',
    )
  })

  it('searches entries', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/wellness/journal')
    await user.type(await screen.findByLabelText('Search your journal'), 'lake')
    await waitFor(() =>
      expect(fakeApi.listJournal).toHaveBeenLastCalledWith({ q: 'lake', offset: 0 }),
    )
  })

  it('asks before deleting an entry', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/wellness/journal')
    await user.click(await screen.findByRole('button', { name: /^delete$/i }))
    expect(fakeApi.deleteJournalEntry).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /delete entry/i }))
    await waitFor(() => expect(fakeApi.deleteJournalEntry).toHaveBeenCalledWith('entry-1'))
  })
})

describe('habits', () => {
  it('shows the streak and the last 7 days ending today', async () => {
    setSession(fakeSession())
    renderRoute('/app/wellness/habits')
    expect(await screen.findByText('2-day streak')).toBeInTheDocument()
    const days = within(screen.getByRole('group', { name: 'Walk: last 7 days' })).getAllByRole(
      'button',
    )
    expect(days).toHaveLength(7)
    expect(days.at(-1)).toHaveAccessibleName(/28 Oct 2026 \(today\)/)
    expect(days.at(-2)).toHaveAttribute('aria-pressed', 'true') // 27 Oct is checked
  })

  it('ticks today immediately and saves it', async () => {
    setSession(fakeSession())
    // Keep the request open so we can see the instant (optimistic) state.
    let finish: (value: unknown) => void = () => {}
    fakeApi.setHabitCheckin.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    )
    const user = userEvent.setup()
    renderRoute('/app/wellness/habits')
    const today = await screen.findByRole('button', { name: /\(today\)/ })
    expect(today).toHaveAttribute('aria-pressed', 'false')
    await user.click(today)
    expect(today).toHaveAttribute('aria-pressed', 'true')
    expect(fakeApi.setHabitCheckin).toHaveBeenCalledWith('habit-1', wellnessToday, true)
    act(() => finish(fakeHabit({ checkins: [wellnessToday, '2026-10-27', '2026-10-26'] })))
    await waitFor(() => expect(today).toHaveAttribute('aria-pressed', 'true'))
  })

  it('rolls back the tick if saving fails', async () => {
    setSession(fakeSession())
    fakeApi.setHabitCheckin.mockRejectedValueOnce(new Error('Network problem'))
    const user = userEvent.setup()
    renderRoute('/app/wellness/habits')
    const today = await screen.findByRole('button', { name: /\(today\)/ })
    await user.click(today)
    expect(await screen.findByRole('alert')).toHaveTextContent('Network problem')
    expect(today).toHaveAttribute('aria-pressed', 'false')
  })

  it('adds a habit with a weekly target', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/wellness/habits')
    await user.type(await screen.findByLabelText('New habit'), 'Read 10 pages')
    await user.selectOptions(screen.getByLabelText('How often'), '3')
    await user.click(screen.getByRole('button', { name: /add/i }))
    await waitFor(() =>
      expect(fakeApi.createHabit).toHaveBeenCalledWith({ name: 'Read 10 pages', targetPerWeek: 3 }),
    )
  })

  it('archives a habit into the archived list', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/wellness/habits')
    await user.click(await screen.findByRole('button', { name: /archive/i }))
    expect(await screen.findByText('Archived habits (1)')).toBeInTheDocument()
    expect(screen.getByText(/no habits yet/i)).toBeInTheDocument()
  })
})

describe('support', () => {
  it('shows how to get help now, and labels draft guidance', async () => {
    setSession(fakeSession())
    renderRoute('/app/wellness/support')
    expect(await screen.findByText('14416')).toBeInTheDocument()
    expect(screen.getByText('112')).toBeInTheDocument()
    expect(screen.getByText(/AI-drafted, pending expert review/)).toBeInTheDocument()
  })
})
