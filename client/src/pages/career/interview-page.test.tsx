import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import { fakeApi, fakeQuestion, questionId } from '@/test/fake-api'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

beforeEach(() => {
  setSession(fakeSession())
})

const longAnswer =
  'I would ask both managers about their deadlines and impact, agree an order with them, and keep both informed.'

describe('interview question list', () => {
  it('shows progress and questions, and filters by role', async () => {
    const user = userEvent.setup()
    renderRoute('/app/career/interview')
    expect(await screen.findByText('0 of 32 practised')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /two managers ask you/i })).toHaveAttribute(
      'href',
      `/app/career/interview/${questionId}`,
    )
    await user.selectOptions(screen.getByLabelText('Role'), 'data_analyst')
    await waitFor(() =>
      expect(fakeApi.listInterviewQuestions).toHaveBeenLastCalledWith({
        role: 'data_analyst',
        category: undefined,
        saved: false,
      }),
    )
  })

  it('saves a question for later', async () => {
    const user = userEvent.setup()
    renderRoute('/app/career/interview')
    await user.click(await screen.findByRole('button', { name: /^save question/i }))
    expect(fakeApi.setQuestionSaved).toHaveBeenCalledWith(questionId, true)
  })
})

describe('practising a question', () => {
  it('shows guidance and asks for a longer answer before sending', async () => {
    const user = userEvent.setup()
    renderRoute(`/app/career/interview/${questionId}`)
    await user.click(await screen.findByText(/how to approach it/i))
    expect(screen.getByText(/agree priorities together/i)).toBeVisible()
    await user.type(screen.getByLabelText('Your answer'), 'Too short')
    await user.click(screen.getByRole('button', { name: /get ai feedback/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 20 characters/i)
    expect(fakeApi.createPracticeAttempt).not.toHaveBeenCalled()
  })

  it('sends the answer for AI feedback', async () => {
    const user = userEvent.setup()
    renderRoute(`/app/career/interview/${questionId}`)
    await user.type(await screen.findByLabelText('Your answer'), longAnswer)
    await user.click(screen.getByRole('button', { name: /get ai feedback/i }))
    await waitFor(() =>
      expect(fakeApi.createPracticeAttempt).toHaveBeenCalledWith(questionId, {
        answer: longAnswer,
        withFeedback: true,
      }),
    )
    expect(screen.getByLabelText('Your answer')).toHaveValue('')
  })

  it('shows saved answers with labelled AI feedback', async () => {
    fakeApi.getInterviewQuestion.mockResolvedValue({
      ...fakeQuestion({ attemptCount: 1 }),
      attempts: [
        {
          id: 'attempt-1',
          questionId,
          answer: longAnswer,
          createdAt: new Date().toISOString(),
          feedback: {
            summary: 'A calm answer.',
            strengths: ['Clear priorities.'],
            improvements: ['Give the result.'],
            suggestedStructure: 'STAR.',
          },
        },
      ],
    })
    renderRoute(`/app/career/interview/${questionId}`)
    expect(await screen.findByText('AI-generated feedback')).toBeInTheDocument()
    expect(screen.getByText('Give the result.')).toBeInTheDocument()
  })

  it('explains when the AI allowance is used up', async () => {
    fakeApi.createPracticeAttempt.mockRejectedValue(
      new ApiError(429, 'quota_exceeded', 'You’ve used all 30 AI answers for this month.'),
    )
    const user = userEvent.setup()
    renderRoute(`/app/career/interview/${questionId}`)
    await user.type(await screen.findByLabelText('Your answer'), longAnswer)
    await user.click(screen.getByRole('button', { name: /get ai feedback/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/used all 30 ai answers/i)
  })
})
