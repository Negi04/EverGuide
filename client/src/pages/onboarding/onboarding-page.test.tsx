import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeApi, fakeMe } from '@/test/fake-api'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

const newUser = fakeMe({
  onboardingCompletedAt: null,
  preferences: {
    lifeStage: null,
    primaryGoals: [],
    targetCareer: null,
    preferredDomains: [],
    skillLevel: null,
  },
})

beforeEach(() => {
  setSession(fakeSession())
  fakeApi.getMe.mockResolvedValue(newUser)
})

describe('onboarding', () => {
  it('explains why each question is asked', async () => {
    renderRoute('/onboarding')
    expect(await screen.findByText(/why we ask/i)).toBeInTheDocument()
  })

  it('does not move on until the step is answered', async () => {
    const user = userEvent.setup()
    renderRoute('/onboarding')
    await user.click(await screen.findByRole('button', { name: /continue/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/choose the stage/i)
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument()
  })

  it('saves all answers and opens the dashboard', async () => {
    const user = userEvent.setup()
    renderRoute('/onboarding')

    await user.click(await screen.findByRole('radio', { name: /recently graduated/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await user.click(await screen.findByRole('checkbox', { name: /find my first job/i }))
    await user.click(screen.getByRole('checkbox', { name: /prepare for interviews/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await user.type(await screen.findByLabelText(/target role/i), 'Frontend developer')
    await user.click(screen.getByRole('radio', { name: /some experience/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await user.click(await screen.findByRole('checkbox', { name: /career & education/i }))
    // From here the dashboard should load with the saved answers.
    fakeApi.getMe.mockResolvedValue(fakeMe())
    await user.click(screen.getByRole('button', { name: /finish/i }))

    expect(await screen.findByRole('heading', { name: /welcome, asha/i })).toBeInTheDocument()
    expect(fakeApi.saveOnboarding).toHaveBeenCalledWith({
      lifeStage: 'recent_graduate',
      primaryGoals: ['find_first_job', 'prepare_for_interviews'],
      targetCareer: 'Frontend developer',
      preferredDomains: ['career'],
      skillLevel: 'intermediate',
    })
  })
})
