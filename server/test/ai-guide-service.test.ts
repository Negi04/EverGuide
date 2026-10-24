import type { ChatStreamEvent } from '@everguide/shared'
import { describe, expect, it } from 'vitest'
import { AppError } from '../src/lib/errors.ts'
import { createAiGuideService, turnErrorMessage } from '../src/services/ai-guide-service.ts'
import type { UserContext } from '../src/services/profile-service.ts'
import { createFakeStore, fakeChat, fakeRetriever, source } from './fakes/ai.ts'

const alice: UserContext = { userId: 'alice', email: 'a@example.com', accessToken: 'a.b.c' }
const bob: UserContext = { userId: 'bob', email: 'b@example.com', accessToken: 'd.e.f' }
const options = { monthlyMessageLimit: 3, minSimilarity: 0.6 }

async function runTurn(
  setup: {
    chat?: ReturnType<typeof fakeChat>
    sources?: ReturnType<typeof source>[]
    monthlyUsed?: number
  } = {},
  content = 'How do I build a budget?',
) {
  const fake = createFakeStore({ monthlyUsed: setup.monthlyUsed })
  const chat = setup.chat ?? fakeChat()
  const retriever = fakeRetriever(setup.sources ?? [source(1), source(2)])
  const service = createAiGuideService(fake.store, retriever, chat, {
    ...options,
    answerTimeoutMs: 200,
  })
  const conversation = await service.createConversation(alice, 'finance')
  const events: ChatStreamEvent[] = []
  let error: unknown = null
  try {
    const turn = await service.prepareTurn(alice, conversation.id, content)
    await turn.run((event) => events.push(event), new AbortController().signal)
  } catch (e) {
    error = e
  }
  return { ...fake, chat, retriever, service, conversation, events, error }
}

const doneEvent = (events: ChatStreamEvent[]) => events.find((e) => e.type === 'done')

describe('a grounded answer', () => {
  it('streams start, deltas and done, then follow-up suggestions', async () => {
    const { events } = await runTurn({
      chat: fakeChat({ parts: ['Track spending ', 'first [1].'] }),
    })
    expect(events.map((e) => e.type)).toEqual(['start', 'delta', 'delta', 'done', 'followups'])
  })

  it('stores only citations that map to retrieved sources', async () => {
    const { events, citations } = await runTurn({
      chat: fakeChat({ parts: ['Use 50/30/20 [2]. Also [9].'] }),
    })
    const done = doneEvent(events)
    expect(done?.type === 'done' && done.message.content).toBe('Use 50/30/20 [2]. Also.')
    expect(done?.type === 'done' && done.message.grounded).toBe(true)
    expect(citations.map((c) => [c.number, c.chunkId])).toEqual([[2, 'chunk-2']])
  })

  it('records usage with token counts', async () => {
    const { usage, events } = await runTurn()
    expect(usage).toEqual([expect.objectContaining({ status: 'completed', tokens: 120 })])
    const done = doneEvent(events)
    expect(done?.type === 'done' && done.usage).toMatchObject({ used: 1, limit: 3 })
  })

  it('names a new conversation after its first question', async () => {
    const { conversations, events } = await runTurn({}, 'How do I build a budget?')
    expect(conversations[0]?.title).toBe('How do I build a budget?')
    const start = events[0]
    expect(start?.type === 'start' && start.conversation.title).toBe('How do I build a budget?')
  })

  it('still answers when follow-up suggestions fail', async () => {
    const { events, error } = await runTurn({ chat: fakeChat({ followUps: new Error('quota') }) })
    expect(error).toBeNull()
    expect(doneEvent(events)).toBeDefined()
    expect(events.some((e) => e.type === 'followups')).toBe(false)
  })
})

describe('when the knowledge base has nothing relevant', () => {
  it('answers without citations and marks the answer as not grounded', async () => {
    const { events, citations, chat } = await runTurn({
      sources: [],
      chat: fakeChat({ parts: ['Not covered [1].'] }),
    })
    const done = doneEvent(events)
    expect(done?.type === 'done' && done.message.grounded).toBe(false)
    expect(done?.type === 'done' && done.message.content).toBe('Not covered.')
    expect(citations).toEqual([])
    expect(chat.calls[0]?.prompt).toContain('No relevant sources were found')
  })
})

describe('crisis messages', () => {
  it('show support information without calling the model or using the allowance', async () => {
    const { events, chat, retriever, usage } = await runTurn({}, 'I want to end my life')
    const done = doneEvent(events)
    expect(done?.type === 'done' && done.message.safetyFlag).toBe('crisis')
    expect(done?.type === 'done' && done.message.content).toMatch(/112/)
    expect(chat.calls).toHaveLength(0)
    expect(retriever.calls).toHaveLength(0)
    expect(usage).toHaveLength(0)
  })

  it('are answered even when the monthly allowance is used up', async () => {
    const { error, events } = await runTurn({ monthlyUsed: 3 }, 'I want to kill myself')
    expect(error).toBeNull()
    expect(doneEvent(events)).toBeDefined()
  })
})

describe('limits and failures', () => {
  it('refuses with 429 before storing anything once the allowance is used', async () => {
    const { error, messages } = await runTurn({ monthlyUsed: 3 })
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).status).toBe(429)
    expect((error as AppError).code).toBe('quota_exceeded')
    expect(messages).toHaveLength(0)
  })

  it('refunds the allowance and removes the question when the model fails mid-answer', async () => {
    const { error, usage, messages } = await runTurn({
      chat: fakeChat({ parts: ['Partial ', 'answer'], failAfter: 1 }),
    })
    expect((error as Error).message).toBe('model connection reset')
    expect(usage).toEqual([expect.objectContaining({ status: 'failed' })])
    expect(messages).toHaveLength(0)
  })

  it('gives up after the answer timeout and reports it in plain language', async () => {
    const { error, usage } = await runTurn({ chat: fakeChat({ hangUntilAborted: true }) })
    expect(turnErrorMessage(error).code).toBe('timeout')
    expect(usage[0]?.status).toBe('failed')
  })
})

describe('conversation access', () => {
  it("returns 404 for another user's conversation", async () => {
    const fake = createFakeStore()
    const service = createAiGuideService(fake.store, fakeRetriever([]), fakeChat(), options)
    const conversation = await service.createConversation(alice, 'career')
    await expect(service.getConversation(bob, conversation.id)).rejects.toMatchObject({
      status: 404,
    })
    await expect(service.prepareTurn(bob, conversation.id, 'hi')).rejects.toMatchObject({
      status: 404,
    })
    await expect(service.deleteConversation(bob, conversation.id)).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('cancellation', () => {
  it('refunds and stores nothing when the user left before the turn started', async () => {
    const fake = createFakeStore()
    const chat = fakeChat()
    const service = createAiGuideService(fake.store, fakeRetriever([source(1)]), chat, options)
    const conversation = await service.createConversation(alice, 'finance')
    const turn = await service.prepareTurn(alice, conversation.id, 'How do I budget?')
    expect(fake.usage[0]?.status).toBe('reserved')

    const controller = new AbortController()
    controller.abort()
    await expect(turn.run(() => {}, controller.signal)).rejects.toThrow()

    expect(fake.usage[0]?.status).toBe('failed')
    expect(fake.messages).toHaveLength(0)
    expect(chat.calls).toHaveLength(0)
  })

  it('does not start generating if the user leaves during the search', async () => {
    const fake = createFakeStore()
    const chat = fakeChat()
    const controller = new AbortController()
    const retriever = {
      async search() {
        controller.abort() // user presses Stop while sources are being retrieved
        return [source(1)]
      },
    }
    const service = createAiGuideService(fake.store, retriever, chat, options)
    const conversation = await service.createConversation(alice, 'finance')
    const turn = await service.prepareTurn(alice, conversation.id, 'How do I budget?')
    await expect(turn.run(() => {}, controller.signal)).rejects.toThrow()

    expect(chat.calls).toHaveLength(0)
    expect(fake.usage[0]?.status).toBe('failed')
    expect(fake.messages).toHaveLength(0)
  })
})

describe('citation order', () => {
  it('lists citations by number, whatever order the answer used them in', async () => {
    const { events } = await runTurn({
      chat: fakeChat({ parts: ['Second idea [2]. First idea [1].'] }),
    })
    const done = events.find((e) => e.type === 'done')
    expect(done?.type === 'done' && done.message.citations.map((c) => c.number)).toEqual([1, 2])
  })
})
