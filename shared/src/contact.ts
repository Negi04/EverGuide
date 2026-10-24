import { z } from 'zod'

export const contactTopics = [
  'general',
  'mentorship',
  'partnerships',
  'support',
  'privacy',
] as const

export const contactMessageSchema = z.object({
  name: z
    .string({ error: 'Please enter your name.' })
    .trim()
    .min(2, 'Please enter your name.')
    .max(80),
  email: z.email('Please enter a valid email address.').max(254),
  topic: z.enum(contactTopics, { error: 'Please choose a topic.' }),
  message: z
    .string({ error: 'Please write a message.' })
    .trim()
    .min(20, 'Please write at least 20 characters so we can help.')
    .max(2000, 'Please keep your message under 2000 characters.'),
})

export type ContactMessage = z.infer<typeof contactMessageSchema>
