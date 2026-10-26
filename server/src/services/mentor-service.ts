import type {
  AvailabilityWindow,
  Booking,
  BookingRequest,
  MentorApplication,
  MentorApplicationForReview,
  MentorCard,
  MentorDetail,
  MentorExpertise,
  MentorProfileUpdate,
  MyMentorProfile,
  Slot,
  VerificationStatus,
} from '@everguide/shared'
import { AppError, databaseError } from '../lib/errors.ts'
import type { Db } from '../lib/supabase.ts'
import type { UserContext } from './profile-service.ts'

export type MentorFilters = { expertise?: MentorExpertise; q?: string; language?: string }

export interface MentorService {
  // Public directory (verified mentors only)
  listMentors(filters: MentorFilters): Promise<MentorCard[]>
  getMentor(mentorId: string): Promise<MentorDetail>
  openSlots(mentorId: string, days: number): Promise<Slot[]>
  // The signed-in user as a mentor
  getOwnProfile(ctx: UserContext): Promise<MyMentorProfile | null>
  apply(ctx: UserContext, input: MentorApplication): Promise<MyMentorProfile>
  updateOwnProfile(ctx: UserContext, patch: MentorProfileUpdate): Promise<MyMentorProfile>
  replaceAvailability(ctx: UserContext, windows: AvailabilityWindow[]): Promise<MyMentorProfile>
  // Bookings (either side)
  listBookings(ctx: UserContext): Promise<Booking[]>
  requestBooking(ctx: UserContext, input: BookingRequest): Promise<string>
  respond(
    ctx: UserContext,
    bookingId: string,
    input: { accept: boolean; meetingUrl?: string; reason?: string | null },
  ): Promise<void>
  cancel(ctx: UserContext, bookingId: string, reason: string | null): Promise<void>
  reschedule(ctx: UserContext, bookingId: string, startsAt: string): Promise<void>
  review(ctx: UserContext, bookingId: string, rating: number, comment: string | null): Promise<void>
  // Admins
  listApplications(): Promise<MentorApplicationForReview[]>
  decide(
    adminId: string,
    verificationId: string,
    decision: 'verified' | 'rejected',
    notes: string | null,
    requestId: string,
  ): Promise<void>
}

type ProfileRow = {
  user_id: string
  headline: string
  bio: string
  job_title: string | null
  company: string | null
  years_experience: number
  expertise: string[]
  languages: string[]
  session_minutes: number
  is_accepting: boolean
  verification_status: VerificationStatus
  verified_at: string | null
}

const PROFILE_COLUMNS =
  'user_id, headline, bio, job_title, company, years_experience, expertise, languages, session_minutes, is_accepting, verification_status, verified_at'

const mentorNotFound = () => new AppError(404, 'not_found', 'Mentor not found.')
const bookingNotFound = () => new AppError(404, 'not_found', 'Booking not found.')

/**
 * The booking functions raise user-facing messages. P0001 = a rule was broken (409),
 * P0002 = not found or not yours (404), 28000 = not signed in (401).
 */
function bookingRuleError(error: { code?: string; message: string }): AppError {
  if (error.code === 'P0001') return new AppError(409, 'conflict', error.message)
  if (error.code === 'P0002') return bookingNotFound()
  if (error.code === '28000') return new AppError(401, 'unauthorized', error.message)
  return databaseError(error)
}

const toTime = (value: string) => value.slice(0, 5) // "09:00:00" → "09:00"

export function createMentorService(
  admin: Db,
  clientFor: (accessToken: string) => Db,
): MentorService {
  async function namesFor(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()
    const { data, error } = await admin.from('profiles').select('id, full_name').in('id', ids)
    if (error) throw databaseError(error)
    return new Map(data.map((p) => [p.id, p.full_name]))
  }

  async function ratingsFor(ids: string[]) {
    if (ids.length === 0) return new Map<string, { average: number; count: number }>()
    const { data, error } = await admin
      .from('mentor_reviews')
      .select('mentor_id, rating')
      .in('mentor_id', ids)
    if (error) throw databaseError(error)
    const totals = new Map<string, { sum: number; count: number }>()
    for (const r of data) {
      const t = totals.get(r.mentor_id) ?? { sum: 0, count: 0 }
      totals.set(r.mentor_id, { sum: t.sum + r.rating, count: t.count + 1 })
    }
    return new Map(
      [...totals].map(([id, t]) => [
        id,
        { average: Math.round((t.sum / t.count) * 10) / 10, count: t.count },
      ]),
    )
  }

  const toCard = (row: ProfileRow, name: string, rating: MentorCard['rating']): MentorCard => ({
    id: row.user_id,
    name,
    headline: row.headline,
    jobTitle: row.job_title,
    company: row.company,
    yearsExperience: row.years_experience,
    expertise: row.expertise as MentorExpertise[], // guaranteed by the CHECK constraint
    languages: row.languages,
    sessionMinutes: row.session_minutes as 30 | 45 | 60,
    isAccepting: row.is_accepting,
    rating,
    verifiedAt: row.verified_at ?? '',
  })

  async function getOwnProfile(ctx: UserContext): Promise<MyMentorProfile | null> {
    const db = clientFor(ctx.accessToken)
    const [profile, verification, availability] = await Promise.all([
      db.from('mentor_profiles').select(PROFILE_COLUMNS).eq('user_id', ctx.userId).maybeSingle(),
      db
        .from('mentor_verifications')
        .select('status, submitted_at, review_notes')
        .eq('mentor_id', ctx.userId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('mentor_availability')
        .select('weekday, start_time, end_time')
        .eq('mentor_id', ctx.userId)
        .order('weekday')
        .order('start_time'),
    ])
    if (profile.error) throw databaseError(profile.error)
    if (verification.error) throw databaseError(verification.error)
    if (availability.error) throw databaseError(availability.error)
    if (!profile.data) return null
    const p = profile.data
    return {
      headline: p.headline,
      bio: p.bio,
      jobTitle: p.job_title,
      company: p.company,
      yearsExperience: p.years_experience,
      expertise: p.expertise as MentorExpertise[],
      languages: p.languages,
      sessionMinutes: p.session_minutes as 30 | 45 | 60,
      isAccepting: p.is_accepting,
      verificationStatus: p.verification_status,
      latestApplication: verification.data
        ? {
            status: verification.data.status,
            submittedAt: verification.data.submitted_at,
            reviewNotes: verification.data.review_notes,
          }
        : null,
      availability: availability.data.map((a) => ({
        weekday: a.weekday,
        startTime: toTime(a.start_time),
        endTime: toTime(a.end_time),
      })),
    }
  }

  async function requireOwnProfile(ctx: UserContext): Promise<MyMentorProfile> {
    const profile = await getOwnProfile(ctx)
    if (!profile) throw new AppError(404, 'not_found', 'You haven’t applied to be a mentor yet.')
    return profile
  }

  async function rpc(
    ctx: UserContext,
    run: (db: Db) => PromiseLike<{ error: { code?: string; message: string } | null }>,
  ) {
    const { error } = await run(clientFor(ctx.accessToken))
    if (error) throw bookingRuleError(error)
  }

  return {
    async listMentors(filters) {
      let query = admin
        .from('mentor_profiles')
        .select(PROFILE_COLUMNS)
        .eq('verification_status', 'verified')
        .order('verified_at', { ascending: true })
        .limit(100)
      if (filters.expertise) query = query.contains('expertise', [filters.expertise])
      if (filters.language) query = query.contains('languages', [filters.language])
      const { data, error } = await query
      if (error) throw databaseError(error)

      const names = await namesFor(data.map((m) => m.user_id))
      const ratings = await ratingsFor(data.map((m) => m.user_id))
      let cards = data.map((row) =>
        toCard(row, names.get(row.user_id) ?? 'EverGuide mentor', ratings.get(row.user_id) ?? null),
      )
      const q = filters.q?.trim().toLowerCase()
      if (q) {
        cards = cards.filter((c) =>
          [c.name, c.headline, c.jobTitle, c.company].some((field) =>
            field?.toLowerCase().includes(q),
          ),
        )
      }
      // Mentors taking requests first.
      return cards.sort((a, b) => Number(b.isAccepting) - Number(a.isAccepting))
    },

    async getMentor(mentorId) {
      const { data, error } = await admin
        .from('mentor_profiles')
        .select(PROFILE_COLUMNS)
        .eq('user_id', mentorId)
        .eq('verification_status', 'verified')
        .maybeSingle()
      if (error) throw databaseError(error)
      if (!data) throw mentorNotFound()

      const [profile, reviews, ratings] = await Promise.all([
        admin.from('profiles').select('full_name, timezone').eq('id', mentorId).single(),
        admin
          .from('mentor_reviews')
          .select('rating, comment, created_at')
          .eq('mentor_id', mentorId)
          .order('created_at', { ascending: false })
          .limit(20),
        ratingsFor([mentorId]),
      ])
      if (profile.error) throw databaseError(profile.error)
      if (reviews.error) throw databaseError(reviews.error)
      return {
        ...toCard(data, profile.data.full_name, ratings.get(mentorId) ?? null),
        bio: data.bio,
        timezone: profile.data.timezone,
        // Reviewer names are not shown: only that the review came from a real session.
        reviews: reviews.data.map((r) => ({
          rating: r.rating,
          comment: r.comment,
          createdAt: r.created_at,
        })),
      }
    },

    async openSlots(mentorId, days) {
      const { data, error } = await admin.rpc('mentor_open_slots', {
        p_mentor_id: mentorId,
        p_days: days,
      })
      if (error) throw databaseError(error)
      return data.map((s) => ({
        startsAt: new Date(s.starts_at).toISOString(),
        endsAt: new Date(s.ends_at).toISOString(),
      }))
    },

    getOwnProfile,

    async apply(ctx, input) {
      const existing = await getOwnProfile(ctx)
      if (existing?.verificationStatus === 'verified') {
        throw new AppError(409, 'conflict', 'You are already a verified mentor.')
      }
      if (existing?.latestApplication?.status === 'pending') {
        throw new AppError(409, 'conflict', 'Your application is already being reviewed.')
      }

      // Written by the server: users can't create a profile with a status of their choosing.
      const profile = {
        headline: input.headline,
        bio: input.bio,
        job_title: input.jobTitle ?? null,
        company: input.company ?? null,
        years_experience: Number(input.yearsExperience),
        expertise: input.expertise,
        languages: input.languages,
        session_minutes: input.sessionMinutes,
        verification_status: 'pending' as const,
        verified_at: null,
      }
      const saved = existing
        ? await admin.from('mentor_profiles').update(profile).eq('user_id', ctx.userId)
        : await admin.from('mentor_profiles').insert({ user_id: ctx.userId, ...profile })
      if (saved.error) throw databaseError(saved.error)

      const verification = await admin.from('mentor_verifications').insert({
        mentor_id: ctx.userId,
        evidence_url: input.evidenceUrl,
        evidence_notes: input.evidenceNotes ?? null,
      })
      if (verification.error) throw databaseError(verification.error)
      return requireOwnProfile(ctx)
    },

    async updateOwnProfile(ctx, patch) {
      await requireOwnProfile(ctx)
      const { error } = await clientFor(ctx.accessToken)
        .from('mentor_profiles')
        .update({
          headline: patch.headline,
          bio: patch.bio,
          job_title: patch.jobTitle,
          company: patch.company,
          years_experience:
            patch.yearsExperience === undefined ? undefined : Number(patch.yearsExperience),
          expertise: patch.expertise,
          languages: patch.languages,
          session_minutes: patch.sessionMinutes,
          is_accepting: patch.isAccepting,
        })
        .eq('user_id', ctx.userId)
      if (error) throw databaseError(error)
      return requireOwnProfile(ctx)
    },

    async replaceAvailability(ctx, windows) {
      const current = await requireOwnProfile(ctx)
      const db = clientFor(ctx.accessToken)
      const removed = await db.from('mentor_availability').delete().eq('mentor_id', ctx.userId)
      if (removed.error) throw databaseError(removed.error)
      if (windows.length > 0) {
        const inserted = await db.from('mentor_availability').insert(
          windows.map((w) => ({
            mentor_id: ctx.userId,
            weekday: w.weekday,
            start_time: w.startTime,
            end_time: w.endTime,
          })),
        )
        if (inserted.error) {
          // Put the previous schedule back rather than leaving the mentor with none.
          await db.from('mentor_availability').insert(
            current.availability.map((w) => ({
              mentor_id: ctx.userId,
              weekday: w.weekday,
              start_time: w.startTime,
              end_time: w.endTime,
            })),
          )
          if (inserted.error.code === '23P01') {
            throw new AppError(409, 'conflict', 'Two of your time windows overlap on the same day.')
          }
          throw databaseError(inserted.error)
        }
      }
      return requireOwnProfile(ctx)
    },

    async listBookings(ctx) {
      const db = clientFor(ctx.accessToken)
      const { data, error } = await db
        .from('bookings')
        .select(
          'id, mentor_id, mentee_id, starts_at, ends_at, status, topic, meeting_url, status_reason',
        )
        .order('starts_at', { ascending: true })
        .limit(200)
      if (error) throw databaseError(error)
      const ids = data.map((b) => b.id)
      const reviews = ids.length
        ? await db.from('mentor_reviews').select('booking_id').in('booking_id', ids)
        : { data: [], error: null }
      if (reviews.error) throw databaseError(reviews.error)
      const reviewed = new Set(reviews.data.map((r) => r.booking_id))
      const names = await namesFor([...new Set(data.flatMap((b) => [b.mentor_id, b.mentee_id]))])
      const now = Date.now()

      return data.map((b) => {
        const role = b.mentor_id === ctx.userId ? 'mentor' : 'mentee'
        const counterpartId = role === 'mentor' ? b.mentee_id : b.mentor_id
        const completed = b.status === 'confirmed' && new Date(b.ends_at).getTime() <= now
        return {
          id: b.id,
          role,
          counterpart: { id: counterpartId, name: names.get(counterpartId) ?? 'EverGuide member' },
          startsAt: new Date(b.starts_at).toISOString(),
          endsAt: new Date(b.ends_at).toISOString(),
          status: completed ? 'completed' : b.status,
          topic: b.topic,
          // The meeting link is only useful (and only shared) once the session is confirmed.
          meetingUrl: b.status === 'confirmed' ? b.meeting_url : null,
          statusReason: b.status_reason,
          reviewed: reviewed.has(b.id),
        }
      })
    },

    async requestBooking(ctx, input) {
      const { data, error } = await clientFor(ctx.accessToken).rpc('request_booking', {
        p_mentor_id: input.mentorId,
        p_starts_at: input.startsAt,
        p_topic: input.topic,
      })
      if (error) throw bookingRuleError(error)
      return data
    },

    respond: (ctx, bookingId, input) =>
      rpc(ctx, (db) =>
        db.rpc('respond_to_booking', {
          p_booking_id: bookingId,
          p_accept: input.accept,
          p_meeting_url: input.meetingUrl ?? null,
          p_reason: input.reason ?? null,
        }),
      ),

    cancel: (ctx, bookingId, reason) =>
      rpc(ctx, (db) => db.rpc('cancel_booking', { p_booking_id: bookingId, p_reason: reason })),

    reschedule: (ctx, bookingId, startsAt) =>
      rpc(ctx, (db) =>
        db.rpc('reschedule_booking', { p_booking_id: bookingId, p_new_starts_at: startsAt }),
      ),

    review: (ctx, bookingId, rating, comment) =>
      rpc(ctx, (db) =>
        db.rpc('submit_mentor_review', {
          p_booking_id: bookingId,
          p_rating: rating,
          p_comment: comment,
        }),
      ),

    async listApplications() {
      const { data, error } = await admin
        .from('mentor_verifications')
        .select('id, mentor_id, evidence_url, evidence_notes, submitted_at')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true })
      if (error) throw databaseError(error)
      if (data.length === 0) return []
      const profiles = await admin
        .from('mentor_profiles')
        .select(PROFILE_COLUMNS)
        .in(
          'user_id',
          data.map((v) => v.mentor_id),
        )
      if (profiles.error) throw databaseError(profiles.error)
      const names = await namesFor(data.map((v) => v.mentor_id))

      return Promise.all(
        data.map(async (v) => {
          const p = profiles.data.find((row) => row.user_id === v.mentor_id)
          const user = await admin.auth.admin.getUserById(v.mentor_id)
          return {
            verificationId: v.id,
            mentorId: v.mentor_id,
            name: names.get(v.mentor_id) ?? 'Unknown',
            email: user.data.user?.email ?? null,
            headline: p?.headline ?? '',
            bio: p?.bio ?? '',
            jobTitle: p?.job_title ?? null,
            company: p?.company ?? null,
            yearsExperience: p?.years_experience ?? 0,
            expertise: (p?.expertise ?? []) as MentorExpertise[],
            evidenceUrl: v.evidence_url,
            evidenceNotes: v.evidence_notes,
            submittedAt: v.submitted_at,
          }
        }),
      )
    },

    async decide(adminId, verificationId, decision, notes, requestId) {
      const reviewedAt = new Date().toISOString()
      // Only a pending application can be decided; a second decision gets a 409.
      const updated = await admin
        .from('mentor_verifications')
        .update({
          status: decision,
          reviewer_id: adminId,
          review_notes: notes,
          reviewed_at: reviewedAt,
        })
        .eq('id', verificationId)
        .eq('status', 'pending')
        .select('mentor_id')
      if (updated.error) throw databaseError(updated.error)
      const mentorId = updated.data[0]?.mentor_id
      if (!mentorId)
        throw new AppError(
          409,
          'conflict',
          'This application was already decided or doesn’t exist.',
        )

      const profile = await admin
        .from('mentor_profiles')
        .update({
          verification_status: decision,
          verified_at: decision === 'verified' ? reviewedAt : null,
        })
        .eq('user_id', mentorId)
      if (profile.error) throw databaseError(profile.error)

      if (decision === 'verified') {
        const role = await admin
          .from('user_roles')
          .upsert(
            { user_id: mentorId, role: 'mentor', granted_by: adminId },
            { ignoreDuplicates: true },
          )
        if (role.error) throw databaseError(role.error)
      }

      await admin.from('notifications').insert({
        user_id: mentorId,
        type: decision === 'verified' ? 'mentor.verified' : 'mentor.rejected',
        title: decision === 'verified' ? 'You’re a verified mentor' : 'Mentor application update',
        body:
          decision === 'verified'
            ? 'Your profile is now visible in the mentor directory. Add your availability to start receiving requests.'
            : 'Your application wasn’t approved this time. You can review the notes and apply again.',
        link_path: '/app/mentors/profile',
      })
      await admin.from('audit_events').insert({
        actor_id: adminId,
        action: decision === 'verified' ? 'mentor.verified' : 'mentor.rejected',
        target_type: 'mentor_verification',
        target_id: verificationId,
        request_id: requestId,
      })
    },
  }
}
