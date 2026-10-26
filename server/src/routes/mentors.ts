import {
  availabilitySchema,
  bookingCancelSchema,
  bookingRequestSchema,
  bookingRescheduleSchema,
  bookingResponseSchema,
  markNotificationsReadSchema,
  mentorApplicationSchema,
  mentorExpertise,
  mentorProfileUpdateSchema,
  mentorReviewSchema,
  verificationDecisionSchema,
} from '@everguide/shared'
import type { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.ts'
import { parse } from '../lib/validation.ts'
import { requireAuth, requireRole, userContext } from '../middleware/auth.ts'
import { createRateLimiter } from '../middleware/rate-limit.ts'
import type { AuthService } from '../services/auth-service.ts'
import type { MentorService } from '../services/mentor-service.ts'
import type { NotificationService } from '../services/notification-service.ts'

const uuid = z.uuid()
function idParam(value: unknown, what: string): string {
  const parsed = uuid.safeParse(value)
  if (!parsed.success) throw new AppError(404, 'not_found', `${what} not found.`)
  return parsed.data
}

const directoryFilters = z.object({
  expertise: z.enum(mentorExpertise).optional(),
  q: z.string().trim().max(100).optional(),
  language: z.string().trim().max(30).optional(),
})
const slotsQuery = z.object({ days: z.coerce.number().int().min(1).max(30).default(14) })

export function registerMentorRoutes(
  api: Router,
  auth: AuthService,
  mentors: MentorService,
  notifications: NotificationService,
  bookingLimit: { windowMs: number; limit: number },
) {
  const authed = requireAuth(auth)

  // Public directory: verified mentors only, safe fields only.
  api.get('/mentors', async (req, res) => {
    res.json(await mentors.listMentors(parse(directoryFilters, req.query)))
  })
  api.get('/mentors/:id', async (req, res) => {
    res.json(await mentors.getMentor(idParam(req.params.id, 'Mentor')))
  })
  api.get('/mentors/:id/slots', async (req, res) => {
    const { days } = parse(slotsQuery, req.query)
    res.json(await mentors.openSlots(idParam(req.params.id, 'Mentor'), days))
  })

  // The signed-in user's mentor profile.
  api.get('/me/mentor-profile', authed, async (req, res) => {
    res.json(await mentors.getOwnProfile(userContext(req)))
  })
  api.post('/me/mentor-profile', authed, async (req, res) => {
    res
      .status(201)
      .json(await mentors.apply(userContext(req), parse(mentorApplicationSchema, req.body)))
  })
  api.patch('/me/mentor-profile', authed, async (req, res) => {
    res.json(
      await mentors.updateOwnProfile(userContext(req), parse(mentorProfileUpdateSchema, req.body)),
    )
  })
  api.put('/me/mentor-profile/availability', authed, async (req, res) => {
    const { windows } = parse(availabilitySchema, req.body)
    res.json(await mentors.replaceAvailability(userContext(req), windows))
  })

  // Bookings.
  api.get('/bookings', authed, async (req, res) => {
    res.json(await mentors.listBookings(userContext(req)))
  })
  api.post('/bookings', createRateLimiter(bookingLimit), authed, async (req, res) => {
    const id = await mentors.requestBooking(userContext(req), parse(bookingRequestSchema, req.body))
    res.status(201).json({ id })
  })
  api.post('/bookings/:id/respond', authed, async (req, res) => {
    const input = parse(bookingResponseSchema, req.body)
    await mentors.respond(userContext(req), idParam(req.params.id, 'Booking'), input)
    res.status(204).end()
  })
  api.post('/bookings/:id/cancel', authed, async (req, res) => {
    const { reason } = parse(bookingCancelSchema, req.body ?? {})
    await mentors.cancel(userContext(req), idParam(req.params.id, 'Booking'), reason ?? null)
    res.status(204).end()
  })
  api.post('/bookings/:id/reschedule', authed, async (req, res) => {
    const { startsAt } = parse(bookingRescheduleSchema, req.body)
    await mentors.reschedule(userContext(req), idParam(req.params.id, 'Booking'), startsAt)
    res.status(204).end()
  })
  api.post('/bookings/:id/review', authed, async (req, res) => {
    const { rating, comment } = parse(mentorReviewSchema, req.body)
    await mentors.review(
      userContext(req),
      idParam(req.params.id, 'Booking'),
      rating,
      comment ?? null,
    )
    res.status(204).end()
  })

  // Admins: mentor verification. The role is checked in the database on every request.
  const adminOnly = [authed, requireRole(auth, 'admin')]
  api.get('/admin/mentor-applications', ...adminOnly, async (_req, res) => {
    res.json(await mentors.listApplications())
  })
  api.post('/admin/mentor-applications/:id/decision', ...adminOnly, async (req, res) => {
    const { decision, notes } = parse(verificationDecisionSchema, req.body)
    await mentors.decide(
      userContext(req).userId,
      idParam(req.params.id, 'Application'),
      decision,
      notes ?? null,
      String(req.id),
    )
    res.status(204).end()
  })

  // In-app notifications.
  api.get('/notifications', authed, async (req, res) => {
    res.json(await notifications.list(userContext(req)))
  })
  api.post('/notifications/read', authed, async (req, res) => {
    const { ids } = parse(markNotificationsReadSchema, req.body ?? {})
    await notifications.markRead(userContext(req), ids)
    res.status(204).end()
  })
}
