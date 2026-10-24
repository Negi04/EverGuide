import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import { conversationId, fakeAnswer, fakeApi, fakeConversation } from '@/test/fake-api'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

beforeEach(() => {
  setSession(fakeSession())
})

describe('starting a conversation', () => {
  it('creates a conversation in the user’s preferred area and streams the first answer', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/app/guide')
    await user.click(
      await screen.findByRole('button', { name: /how do i choose between two career paths/i }),
    )

    expect(await screen.findByText(/track your spending for a month first/i)).toBeInTheDocument()
    expect(fakeApi.createConversation).toHaveBeenCalledWith('career')
    expect(fakeApi.streamMessage).toHaveBeenCalledWith(
      conversationId,
      'How do I choose between two career paths?',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(router.state.location.pathname).toBe(`/app/guide/${conversationId}`)
    expect(screen.getByText('AI-generated')).toBeInTheDocument()
    expect(screen.getByText(/based on 1 everguide guide/i)).toBeInTheDocument()
  })
})

describe('an answer', () => {
  async function openWithAnswer(answer = fakeAnswer()) {
    fakeApi.getConversation.mockResolvedValue(
      fakeConversation({
        title: 'Budget help',
        messages: [
          { ...answer, id: 'q', role: 'user', content: 'How do I budget?', citations: [] },
          answer,
        ],
      }),
    )
    renderRoute(`/app/guide/${conversationId}`)
    return screen.findByRole('article', { name: /ai guide answer/i })
  }

  it('opens the exact source passage behind a citation', async () => {
    const answer = await openWithAnswer()
    await userEvent.setup().click(within(answer).getByRole('button', { name: 'Source 1' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Budgeting basics')).toBeInTheDocument()
    expect(within(sheet).getByText(/record all income and spending/i)).toBeInTheDocument()
    expect(within(sheet).getByText(/pending expert review/i)).toBeInTheDocument()
  })

  it('warns when an answer is not based on EverGuide sources', async () => {
    await openWithAnswer(fakeAnswer({ grounded: false, citations: [], content: 'Not covered.' }))
    expect(screen.getByText(/not based on everguide sources/i)).toBeInTheDocument()
  })

  it('labels crisis support differently from normal answers', async () => {
    await openWithAnswer(
      fakeAnswer({ safetyFlag: 'crisis', grounded: false, citations: [], content: 'Call 112.' }),
    )
    expect(screen.getByText(/support information/i)).toBeInTheDocument()
    expect(screen.queryByText('AI-generated')).not.toBeInTheDocument()
  })

  it('records feedback', async () => {
    const answer = await openWithAnswer()
    const helpful = within(answer).getByRole('button', { name: 'Helpful' })
    await userEvent.setup().click(helpful)
    expect(fakeApi.sendFeedback).toHaveBeenCalledWith('answer-1', { rating: 'helpful' })
    await waitFor(() => expect(helpful).toHaveAttribute('aria-pressed', 'true'))
  })
})

describe('when things go wrong', () => {
  async function ask(question = 'How do I budget?') {
    const user = userEvent.setup()
    renderRoute(`/app/guide/${conversationId}`)
    await user.type(await screen.findByLabelText(/your question/i), question)
    await user.click(screen.getByRole('button', { name: 'Send' }))
    return user
  }

  it('explains the monthly limit and disables asking', async () => {
    fakeApi.streamMessage.mockRejectedValue(
      new ApiError(429, 'quota_exceeded', 'You’ve used all 30 AI Guide answers for this month.'),
    )
    await ask()
    expect(await screen.findByText(/used all 30 ai guide answers/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /see plans/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/your question/i)).toBeDisabled()
  })

  it('offers a retry when the answer fails', async () => {
    fakeApi.streamMessage.mockImplementationOnce(async (_id, _q, { onEvent }) => {
      onEvent({
        type: 'error',
        code: 'failed',
        message: 'The AI Guide couldn’t finish this answer. Please try again.',
      })
    })
    const user = await ask()
    await user.click(await screen.findByRole('button', { name: /retry/i }))
    expect(await screen.findByText(/track your spending for a month first/i)).toBeInTheDocument()
    expect(fakeApi.streamMessage).toHaveBeenCalledTimes(2)
  })

  it('puts the question back when the user stops the answer', async () => {
    fakeApi.streamMessage.mockImplementation(
      (_id, _q, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new DOMException('', 'AbortError'))),
        ),
    )
    const user = await ask('A question I want to rephrase')
    await user.click(await screen.findByRole('button', { name: /stop/i }))
    await waitFor(() =>
      expect(screen.getByLabelText(/your question/i)).toHaveValue('A question I want to rephrase'),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a clear message for a conversation that does not exist', async () => {
    fakeApi.getConversation.mockRejectedValue(
      new ApiError(404, 'not_found', 'Conversation not found.'),
    )
    renderRoute(`/app/guide/${conversationId}`)
    expect(
      await screen.findByRole('heading', { name: /conversation not found/i }),
    ).toBeInTheDocument()
  })
})

describe('managing conversations', () => {
  it('searches conversation titles', async () => {
    fakeApi.listConversations.mockResolvedValue([{ ...fakeConversation(), title: 'Budget help' }])
    const user = userEvent.setup()
    renderRoute('/app/guide')
    const [search] = await screen.findAllByRole('searchbox', { name: /search conversations/i })
    await user.type(search!, 'budget')
    await waitFor(() => expect(fakeApi.listConversations).toHaveBeenCalledWith('budget'))
  })

  it('renames and deletes a conversation', async () => {
    fakeApi.getConversation.mockResolvedValue(fakeConversation({ title: 'Old title' }))
    const user = userEvent.setup()
    const { router } = renderRoute(`/app/guide/${conversationId}`)

    await user.click(await screen.findByRole('button', { name: /rename conversation/i }))
    const renameDialog = await screen.findByRole('dialog', { name: /rename conversation/i })
    await user.clear(within(renameDialog).getByLabelText('Title'))
    await user.type(within(renameDialog).getByLabelText('Title'), 'Budget plan')
    await user.click(within(renameDialog).getByRole('button', { name: 'Save' }))
    expect(fakeApi.updateConversation).toHaveBeenCalledWith(conversationId, {
      title: 'Budget plan',
    })

    await user.click(await screen.findByRole('button', { name: /delete conversation/i }))
    const deleteDialog = await screen.findByRole('dialog', { name: /delete this conversation/i })
    await user.click(within(deleteDialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/guide'))
    expect(fakeApi.deleteConversation).toHaveBeenCalledWith(conversationId)
  })
})

describe('grounding label', () => {
  it('counts guides rather than passages so it never overstates the evidence', async () => {
    const citation = fakeAnswer().citations[0]!
    const answer = fakeAnswer({
      citations: [citation, { ...citation, number: 2, excerpt: 'Another passage.' }],
    })
    fakeApi.getConversation.mockResolvedValue(fakeConversation({ messages: [answer] }))
    renderRoute(`/app/guide/${conversationId}`)
    expect(await screen.findByText('Based on 1 EverGuide guide (2 passages)')).toBeInTheDocument()
  })
})
