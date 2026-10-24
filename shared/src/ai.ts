import { z } from 'zod'
import { guidanceDomains, type GuidanceDomain } from './profile.ts'

export const conversationCreateSchema = z.object({
  domain: z.enum(guidanceDomains).default('career'),
})

export const conversationUpdateSchema = z
  .object({
    title: z.string().trim().min(1, 'Please enter a title.').max(120, 'Keep the title under 120 characters.'),
    domain: z.enum(guidanceDomains),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

export const sendMessageSchema = z.object({
  content: z
    .string({ error: 'Please type a question.' })
    .trim()
    .min(1, 'Please type a question.')
    .max(4000, 'Please keep your question under 4000 characters.'),
})

export const feedbackRatings = ['helpful', 'not_helpful'] as const

export const feedbackSchema = z.object({
  rating: z.enum(feedbackRatings),
  comment: z.string().trim().max(1000).optional(),
})

export type ConversationCreate = z.input<typeof conversationCreateSchema>
export type ConversationUpdate = z.infer<typeof conversationUpdateSchema>
export type SendMessage = z.infer<typeof sendMessageSchema>
export type Feedback = z.infer<typeof feedbackSchema>
export type FeedbackRating = (typeof feedbackRatings)[number]

export type ConversationSummary = {
  id: string
  title: string
  domain: GuidanceDomain
  lastMessageAt: string
}

/** A source behind an answer. `number` matches the [n] marker in the answer text. */
export type Citation = {
  number: number
  title: string
  sourceName: string
  sourceUrl: string | null
  excerpt: string
  similarity: number
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  /** Assistant only: true when the answer cites retrieved sources. */
  grounded: boolean | null
  safetyFlag: 'crisis' | null
  citations: Citation[]
  feedback: FeedbackRating | null
}

export type ConversationDetail = ConversationSummary & { messages: ChatMessage[] }

export type AiUsage = { used: number; limit: number; periodEnd: string }

/** Server-sent events streamed while an answer is generated. */
export type ChatStreamEvent =
  | { type: 'start'; userMessage: ChatMessage; conversation: ConversationSummary }
  | { type: 'delta'; text: string }
  | { type: 'done'; message: ChatMessage; usage: AiUsage; followUps: string[] }
  | { type: 'error'; code: string; message: string }
