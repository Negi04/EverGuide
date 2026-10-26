import { z } from 'zod'

// Must match the CHECK constraint on mentor_profiles.expertise.
export const mentorExpertise = [
  'software_engineering',
  'data_analytics',
  'product_management',
  'design',
  'marketing',
  'finance',
  'consulting',
  'career_switching',
  'interview_preparation',
  'higher_studies',
  'entrepreneurship',
  'wellbeing',
] as const
export type MentorExpertise = (typeof mentorExpertise)[number]

const unique = <T>(values: T[]) => new Set(values).size === values.length
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional()
const httpsUrl = (message: string) =>
  z
    .string()
    .trim()
    .max(500)
    .regex(/^https:\/\/\S+$/, message)

const profileFields = {
  headline: z.string().trim().min(10, 'Write a headline of at least 10 characters.').max(120),
  bio: z.string().trim().min(50, 'Tell mentees a bit more (at least 50 characters).').max(2000),
  jobTitle: optionalText(120),
  company: optionalText(120),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  expertise: z
    .array(z.enum(mentorExpertise))
    .min(1, 'Choose at least one area.')
    .max(6, 'Choose up to six areas.')
    .refine(unique, 'Each area can only be chosen once.'),
  languages: z
    .array(z.string().trim().min(2).max(30))
    .min(1, 'Add at least one language.')
    .max(6)
    .refine(unique, 'Each language can only be listed once.'),
  sessionMinutes: z.union([z.literal(30), z.literal(45), z.literal(60)]),
}

export const mentorApplicationSchema = z.object({
  ...profileFields,
  evidenceUrl: httpsUrl(
    'Add an https link (for example, your LinkedIn profile) that shows your experience.',
  ),
  evidenceNotes: optionalText(2000),
})

export const mentorProfileUpdateSchema = z
  .object({ ...profileFields, isAccepting: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour).')

export const availabilitySchema = z.object({
  windows: z
    .array(
      z
        .object({ weekday: z.number().int().min(1).max(7), startTime: time, endTime: time })
        .refine((w) => w.endTime > w.startTime, {
          message: 'End time must be after start time.',
          path: ['endTime'],
        }),
    )
    .max(21, 'Up to 21 time windows.'),
})

export const bookingRequestSchema = z.object({
  mentorId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
  topic: z
    .string()
    .trim()
    .min(10, 'Describe what you’d like to discuss (at least 10 characters).')
    .max(500),
})

export const bookingResponseSchema = z
  .object({
    accept: z.boolean(),
    meetingUrl: httpsUrl('Add an https meeting link (for example Google Meet or Zoom).').optional(),
    reason: optionalText(500),
  })
  .refine((value) => !value.accept || Boolean(value.meetingUrl), {
    message: 'Add a meeting link to confirm the session.',
    path: ['meetingUrl'],
  })

export const bookingCancelSchema = z.object({ reason: optionalText(500) })
export const bookingRescheduleSchema = z.object({ startsAt: z.iso.datetime({ offset: true }) })
export const mentorReviewSchema = z.object({
  rating: z.number().int().min(1, 'Choose a rating.').max(5),
  comment: optionalText(1000),
})
export const verificationDecisionSchema = z.object({
  decision: z.enum(['verified', 'rejected']),
  notes: optionalText(2000),
})
export const markNotificationsReadSchema = z.object({ ids: z.array(z.uuid()).max(100).optional() })

export type MentorApplication = z.input<typeof mentorApplicationSchema>
export type MentorProfileUpdate = z.input<typeof mentorProfileUpdateSchema>
export type AvailabilityWindow = z.infer<typeof availabilitySchema>['windows'][number]
export type BookingRequest = z.infer<typeof bookingRequestSchema>
export type BookingResponse = z.input<typeof bookingResponseSchema>
export type MentorReviewInput = z.input<typeof mentorReviewSchema>
export type VerificationDecision = z.input<typeof verificationDecisionSchema>

export type VerificationStatus = 'pending' | 'verified' | 'rejected'

/** A mentor as shown in the public directory. Only verified mentors are listed. */
export type MentorCard = {
  id: string
  name: string
  headline: string
  jobTitle: string | null
  company: string | null
  yearsExperience: number
  expertise: MentorExpertise[]
  languages: string[]
  sessionMinutes: 30 | 45 | 60
  isAccepting: boolean
  rating: { average: number; count: number } | null
  verifiedAt: string
}

export type MentorDetail = MentorCard & {
  bio: string
  timezone: string
  reviews: { rating: number; comment: string | null; createdAt: string }[]
}

export type Slot = { startsAt: string; endsAt: string }

/** The signed-in user's own mentor profile and application status. */
export type MyMentorProfile = {
  headline: string
  bio: string
  jobTitle: string | null
  company: string | null
  yearsExperience: number
  expertise: MentorExpertise[]
  languages: string[]
  sessionMinutes: 30 | 45 | 60
  isAccepting: boolean
  verificationStatus: VerificationStatus
  latestApplication: {
    status: VerificationStatus
    submittedAt: string
    reviewNotes: string | null
  } | null
  availability: AvailabilityWindow[]
}

export type BookingDisplayStatus =
  'requested' | 'confirmed' | 'completed' | 'declined' | 'cancelled'

export type Booking = {
  id: string
  /** The signed-in user's side of this booking. */
  role: 'mentor' | 'mentee'
  counterpart: { id: string; name: string }
  startsAt: string
  endsAt: string
  status: BookingDisplayStatus
  topic: string
  meetingUrl: string | null
  statusReason: string | null
  reviewed: boolean
}

export type MentorApplicationForReview = {
  verificationId: string
  mentorId: string
  name: string
  email: string | null
  headline: string
  bio: string
  jobTitle: string | null
  company: string | null
  yearsExperience: number
  expertise: MentorExpertise[]
  evidenceUrl: string
  evidenceNotes: string | null
  submittedAt: string
}

export type AppNotification = {
  id: string
  type: string
  title: string
  body: string | null
  linkPath: string | null
  readAt: string | null
  createdAt: string
}
