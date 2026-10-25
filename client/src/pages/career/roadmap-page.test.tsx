import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeApi, fakeGoal } from '@/test/fake-api'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

beforeEach(() => {
  setSession(fakeSession())
})

describe('roadmap', () => {
  it('invites the user to set a first goal and creates it with milestones', async () => {
    const user = userEvent.setup()
    renderRoute('/app/career')
    await user.click(await screen.findByRole('button', { name: /new goal/i }))
    const dialog = await screen.findByRole('dialog', { name: /new goal/i })
    await user.type(within(dialog).getByLabelText('Goal'), 'Get my first data analyst job')
    await user.type(within(dialog).getByLabelText('Milestone 1'), 'Finish an SQL course')
    await user.click(within(dialog).getByRole('button', { name: /add a milestone/i }))
    await user.type(within(dialog).getByLabelText('Milestone 2'), '   ') // blank rows are ignored
    await user.click(within(dialog).getByRole('button', { name: /create goal/i }))

    expect(
      await screen.findByRole('heading', { name: 'Get my first data analyst job' }),
    ).toBeInTheDocument()
    expect(fakeApi.createGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Get my first data analyst job',
        milestones: [{ title: 'Finish an SQL course' }],
      }),
    )
  })

  it('validates the goal title before sending', async () => {
    const user = userEvent.setup()
    renderRoute('/app/career')
    await user.click(await screen.findByRole('button', { name: /new goal/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /create goal/i }))
    expect(await within(dialog).findByText(/give your goal a title/i)).toBeInTheDocument()
    expect(fakeApi.createGoal).not.toHaveBeenCalled()
  })

  it('shows progress and ticks off milestones', async () => {
    fakeApi.listGoals.mockResolvedValue([fakeGoal()])
    const user = userEvent.setup()
    renderRoute('/app/career')
    expect(await screen.findByText('1 of 2 milestones done')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /build a portfolio project: not done/i }))
    expect(fakeApi.updateMilestone).toHaveBeenCalledWith('m2', { completed: true })
    expect(await screen.findByText('2 of 2 milestones done')).toBeInTheDocument()
  })

  it('marks a goal complete and moves it to the Completed filter', async () => {
    fakeApi.listGoals.mockResolvedValue([fakeGoal()])
    const user = userEvent.setup()
    renderRoute('/app/career')
    await user.click(await screen.findByRole('button', { name: /mark goal complete/i }))
    expect(fakeApi.updateGoal).toHaveBeenCalledWith('goal-1', { status: 'completed' })
    await waitFor(() => expect(screen.getByText('No active goals.')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /completed \(1\)/i }))
    expect(
      await screen.findByRole('heading', { name: 'Become a data analyst' }),
    ).toBeInTheDocument()
  })

  it('flags overdue goals', async () => {
    fakeApi.listGoals.mockResolvedValue([fakeGoal({ targetDate: '2020-01-15' })])
    renderRoute('/app/career')
    expect(await screen.findByText(/overdue/i)).toBeInTheDocument()
  })

  it('shows recommended reading from the knowledge base on request', async () => {
    fakeApi.listGoals.mockResolvedValue([fakeGoal()])
    const user = userEvent.setup()
    renderRoute('/app/career')
    await user.click(await screen.findByRole('button', { name: /recommended reading/i }))
    expect(await screen.findByText('Switching to a new career')).toBeInTheDocument()
    expect(fakeApi.goalRecommendations).toHaveBeenCalledWith('goal-1')
  })

  it('deletes a goal after confirmation', async () => {
    fakeApi.listGoals.mockResolvedValue([fakeGoal()])
    const user = userEvent.setup()
    renderRoute('/app/career')
    await user.click(await screen.findByRole('button', { name: /delete become a data analyst/i }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /delete goal/i }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Become a data analyst' }),
      ).not.toBeInTheDocument(),
    )
    expect(fakeApi.deleteGoal).toHaveBeenCalledWith('goal-1')
  })

  it('shows active goals with progress on the dashboard', async () => {
    fakeApi.listGoals.mockResolvedValue([fakeGoal()])
    renderRoute('/app')
    expect(await screen.findByRole('heading', { name: 'Your goals' })).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })
})

describe('roadmap regressions', () => {
  it('creates a goal when the starter milestone row is left empty', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/career')
    await user.click(await screen.findByRole('button', { name: /new goal/i }))
    const dialog = await screen.findByRole('dialog', { name: /new goal/i })
    await user.type(within(dialog).getByLabelText('Goal'), 'Learn to cook')
    await user.click(within(dialog).getByRole('button', { name: /create goal/i }))
    expect(await screen.findByRole('heading', { name: 'Learn to cook' })).toBeInTheDocument()
    expect(fakeApi.createGoal).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Learn to cook', milestones: [] }),
    )
  })
})

describe('roadmap date handling', () => {
  it('sends a chosen target date and no date when the field is left empty', async () => {
    setSession(fakeSession())
    const user = userEvent.setup()
    renderRoute('/app/career')
    await user.click(await screen.findByRole('button', { name: /new goal/i }))
    const dialog = await screen.findByRole('dialog', { name: /new goal/i })
    await user.type(within(dialog).getByLabelText('Goal'), 'Finish my certificate')
    await user.type(within(dialog).getByLabelText(/target date/i), '2027-03-31')
    await user.click(within(dialog).getByRole('button', { name: /create goal/i }))
    await screen.findByRole('heading', { name: 'Finish my certificate' })
    expect(fakeApi.createGoal).toHaveBeenCalledWith(
      expect.objectContaining({ targetDate: '2027-03-31' }),
    )
  })
})
