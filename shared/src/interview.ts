import { z } from 'zod'

export const interviewCategories = ['behavioural', 'technical', 'situational'] as const
export const interviewRoles = [
  'general',
  'software_engineer',
  'data_analyst',
  'product_manager',
  'designer',
  'marketing',
] as const
export const interviewDifficulties = ['foundation', 'intermediate', 'advanced'] as const

export type InterviewCategory = (typeof interviewCategories)[number]
export type InterviewRole = (typeof interviewRoles)[number]
export type InterviewDifficulty = (typeof interviewDifficulties)[number]

export const practiceAttemptSchema = z.object({
  answer: z
    .string({ error: 'Write your answer first.' })
    .trim()
    .min(20, 'Write at least 20 characters so there is something to practise with.')
    .max(5000, 'Keep your answer under 5000 characters.'),
  withFeedback: z.boolean().default(false),
})

export const savedQuestionSchema = z.object({ saved: z.boolean() })

/** Size limits for AI feedback: used by the schema below, the model's schema and trimming. */
export const INTERVIEW_FEEDBACK_LIMITS = {
  summary: 600,
  strengths: 4,
  improvements: 4,
  point: 300,
  suggestedStructure: 800,
} as const

/** Shape the AI must return; also validated on the server before saving. */
export const interviewFeedbackSchema = z.object({
  summary: z.string().trim().min(1).max(INTERVIEW_FEEDBACK_LIMITS.summary),
  strengths: z
    .array(z.string().trim().min(1).max(INTERVIEW_FEEDBACK_LIMITS.point))
    .max(INTERVIEW_FEEDBACK_LIMITS.strengths),
  improvements: z
    .array(z.string().trim().min(1).max(INTERVIEW_FEEDBACK_LIMITS.point))
    .max(INTERVIEW_FEEDBACK_LIMITS.improvements),
  suggestedStructure: z.string().trim().max(INTERVIEW_FEEDBACK_LIMITS.suggestedStructure),
})

export type PracticeAttemptInput = z.input<typeof practiceAttemptSchema>
export type InterviewFeedback = z.infer<typeof interviewFeedbackSchema>

export type InterviewQuestion = {
  id: string
  slug: string
  category: InterviewCategory
  role: InterviewRole
  difficulty: InterviewDifficulty
  prompt: string
  guidance: string
  saved: boolean
  attemptCount: number
  lastPractisedAt: string | null
}

export type PracticeAttempt = {
  id: string
  questionId: string
  answer: string
  feedback: InterviewFeedback | null
  createdAt: string
}

export type InterviewQuestionList = {
  questions: InterviewQuestion[]
  /** Progress across all questions, regardless of filters. */
  progress: { practised: number; total: number }
}

export type InterviewQuestionDetail = InterviewQuestion & { attempts: PracticeAttempt[] }
