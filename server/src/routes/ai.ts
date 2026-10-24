import {
  conversationCreateSchema,
  conversationUpdateSchema,
  feedbackSchema,
  sendMessageSchema,
  type ChatStreamEvent,
} from '@everguide/shared'
import type { RequestHandler, Router } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.ts'
import { parse } from '../lib/validation.ts'
import { requireAuth, userContext } from '../middleware/auth.ts'
import { createRateLimiter } from '../middleware/rate-limit.ts'
import { turnErrorMessage, type AiGuideService } from '../services/ai-guide-service.ts'
import type { AuthService } from '../services/auth-service.ts'

const uuid = z.uuid()

/** Malformed IDs get the same 404 as IDs that belong to someone else. */
function idParam(value: unknown, what: string): string {
  const parsed = uuid.safeParse(value)
  if (!parsed.success) throw new AppError(404, 'not_found', `${what} not found.`)
  return parsed.data
}

/** Registers the AI Guide endpoints on the /api/v1 router. */
export function registerAiRoutes(
  api: Router,
  auth: AuthService,
  aiGuide: AiGuideService | null,
  answerLimit: { windowMs: number; limit: number },
) {
  const authed = requireAuth(auth)
  const available: RequestHandler = (_req, _res, next) =>
    next(
      aiGuide
        ? undefined
        : new AppError(503, 'service_unavailable', 'The AI Guide is not available right now.'),
    )
  const guide = () => aiGuide as AiGuideService
  const guarded = [authed, available]

  api.get('/conversations', ...guarded, async (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : undefined
    res.json(await guide().listConversations(userContext(req), search || undefined))
  })

  api.post('/conversations', ...guarded, async (req, res) => {
    const { domain } = parse(conversationCreateSchema, req.body ?? {})
    res.status(201).json(await guide().createConversation(userContext(req), domain))
  })

  api.get('/conversations/:id', ...guarded, async (req, res) => {
    res.json(
      await guide().getConversation(userContext(req), idParam(req.params.id, 'Conversation')),
    )
  })

  api.patch('/conversations/:id', ...guarded, async (req, res) => {
    const patch = parse(conversationUpdateSchema, req.body)
    res.json(
      await guide().updateConversation(
        userContext(req),
        idParam(req.params.id, 'Conversation'),
        patch,
      ),
    )
  })

  api.delete('/conversations/:id', ...guarded, async (req, res) => {
    await guide().deleteConversation(userContext(req), idParam(req.params.id, 'Conversation'))
    res.status(204).end()
  })

  // Answers stream as server-sent events. Every check that can fail with a normal HTTP
  // error (auth, validation, not found, allowance) runs before the stream opens.
  api.post(
    '/conversations/:id/messages',
    createRateLimiter(answerLimit),
    ...guarded,
    async (req, res) => {
      // Watch for the user leaving (Stop, closed tab) from the very first moment: a
      // disconnect can arrive while the allowance is still being checked, and a listener
      // added later would never hear about it.
      const controller = new AbortController()
      res.on('close', () => {
        if (!res.writableFinished) controller.abort()
      })

      const conversationId = idParam(req.params.id, 'Conversation')
      const { content } = parse(sendMessageSchema, req.body)
      const turn = await guide().prepareTurn(userContext(req), conversationId, content)

      res.status(200).set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Stop reverse proxies (e.g. nginx) from buffering the stream.
        'X-Accel-Buffering': 'no',
      })
      res.flushHeaders()

      const emit = (event: ChatStreamEvent) => {
        if (!res.writableEnded)
          res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      }

      try {
        await turn.run(emit, controller.signal)
      } catch (error) {
        if (!controller.signal.aborted) {
          req.log.error({ err: error }, 'AI Guide turn failed')
          emit({ type: 'error', ...turnErrorMessage(error) })
        }
      }
      res.end()
    },
  )

  api.put('/messages/:id/feedback', ...guarded, async (req, res) => {
    const feedback = parse(feedbackSchema, req.body)
    await guide().saveFeedback(userContext(req), idParam(req.params.id, 'Answer'), feedback)
    res.status(204).end()
  })

  api.get('/ai/usage', ...guarded, async (req, res) => {
    res.json(await guide().getUsage(userContext(req)))
  })
}
