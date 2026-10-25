import { z } from 'zod'

export const goalCategories = [
  'career',
  'skill',
  'education',
  'wellbeing',
  'finance',
  'other',
] as const
export const goalStatuses = ['active', 'completed', 'archived'] as const

export type GoalCategory = (typeof goalCategories)[number]
export type GoalStatus = (typeof goalStatuses)[number]

const isoDate = z.iso.date({ error: 'Use a valid date.' })
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional()

const milestoneTitle = z
  .string({ error: 'Give the milestone a title.' })
  .trim()
  .min(2, 'Give the milestone a title.')
  .max(160, 'Keep the title under 160 characters.')

export const goalCreateSchema = z.object({
  title: z
    .string({ error: 'Give your goal a title.' })
    .trim()
    .min(3, 'Give your goal a title of at least 3 characters.')
    .max(120, 'Keep the title under 120 characters.'),
  description: optionalText(1000),
  category: z.enum(goalCategories).default('career'),
  targetDate: isoDate.nullable().optional(),
  milestones: z
    .array(z.object({ title: milestoneTitle, targetDate: isoDate.nullable().optional() }))
    .max(30, 'A goal can have up to 30 milestones.')
    .default([]),
})

export const goalUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: optionalText(1000),
    category: z.enum(goalCategories),
    targetDate: isoDate.nullable(),
    status: z.enum(goalStatuses),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

export const milestoneCreateSchema = z.object({
  title: milestoneTitle,
  targetDate: isoDate.nullable().optional(),
})

export const milestoneUpdateSchema = z
  .object({
    title: milestoneTitle,
    notes: optionalText(1000),
    targetDate: isoDate.nullable(),
    completed: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

export type GoalCreate = z.input<typeof goalCreateSchema>
export type GoalUpdate = z.infer<typeof goalUpdateSchema>
export type MilestoneCreate = z.infer<typeof milestoneCreateSchema>
export type MilestoneUpdate = z.infer<typeof milestoneUpdateSchema>

export type Milestone = {
  id: string
  goalId: string
  title: string
  notes: string | null
  targetDate: string | null
  position: number
  completedAt: string | null
}

export type Goal = {
  id: string
  title: string
  description: string | null
  category: GoalCategory
  targetDate: string | null
  status: GoalStatus
  completedAt: string | null
  createdAt: string
  milestones: Milestone[]
}

/** A knowledge-base guide suggested for a goal (from the same search as the AI Guide). */
export type Recommendation = { title: string; sourceName: string; excerpt: string }
