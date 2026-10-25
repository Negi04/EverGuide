import type { BookingDisplayStatus, MentorExpertise } from '@everguide/shared'

export const expertiseLabels: Record<MentorExpertise, string> = {
  software_engineering: 'Software engineering',
  data_analytics: 'Data & analytics',
  product_management: 'Product management',
  design: 'Design',
  marketing: 'Marketing',
  finance: 'Finance',
  consulting: 'Consulting',
  career_switching: 'Career switching',
  interview_preparation: 'Interview preparation',
  higher_studies: 'Higher studies',
  entrepreneurship: 'Entrepreneurship',
  wellbeing: 'Wellbeing',
}

/** ISO weekdays: 1 = Monday. */
export const weekdayLabels: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
}

export const bookingStatusLabels: Record<BookingDisplayStatus, string> = {
  requested: 'Waiting for the mentor',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
}
