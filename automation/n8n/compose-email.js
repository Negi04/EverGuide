// EverGuide → n8n: turn each verified event into an email for the demo test inbox.
// Runs in the "Compose email" Code node. Events of unknown types are skipped.
//
// Every email goes to one test inbox: events carry first names, not addresses,
// so nothing here can reach a real person by mistake.
const INBOX = 'demo-inbox@everguide.test'
const ADMIN_INBOX = 'admin-inbox@everguide.test'

function when(iso, zone) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: zone || 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return iso
  }
}

const templates = {
  'user.welcome': (d) => ({
    subject: 'Welcome to EverGuide',
    text: `Hi ${d.firstName},\n\nWelcome to EverGuide. Start with the AI Guide or set your first career goal.\n\nThe EverGuide team`,
  }),
  'booking.requested': (d) => ({
    subject: `Session requested with ${d.mentorFirstName}`,
    text: `Hi ${d.menteeFirstName},\n\nYou asked ${d.mentorFirstName} for a session on ${when(d.startsAt, d.menteeTimezone)}. We'll email you when they reply.`,
  }),
  'booking.confirmed': (d) => ({
    subject: `Confirmed: your session with ${d.mentorFirstName}`,
    text: `Hi ${d.menteeFirstName},\n\n${d.mentorFirstName} confirmed your session on ${when(d.startsAt, d.menteeTimezone)}. You'll find the meeting link under Mentors → Sessions.`,
  }),
  'booking.declined': (d) => ({
    subject: `${d.mentorFirstName} couldn't take your session`,
    text: `Hi ${d.menteeFirstName},\n\n${d.mentorFirstName} can't make ${when(d.startsAt, d.menteeTimezone)}. You can pick another time or another mentor.`,
  }),
  'booking.cancelled': (d) => ({
    subject: 'Session cancelled',
    text: `Hi ${d.menteeFirstName},\n\nYour session with ${d.mentorFirstName} on ${when(d.startsAt, d.menteeTimezone)} was cancelled.`,
  }),
  'booking.rescheduled': (d) => ({
    subject: 'Session moved',
    text: `Hi ${d.menteeFirstName},\n\nYour session with ${d.mentorFirstName} is now requested for ${when(d.startsAt, d.menteeTimezone)}.`,
  }),
  'booking.reminder': (d) => ({
    subject: `Starting soon: your session with ${d.mentorFirstName}`,
    text: `Hi ${d.menteeFirstName},\n\nA reminder: your session with ${d.mentorFirstName} starts at ${when(d.startsAt, d.menteeTimezone)}.`,
  }),
  'payment.succeeded': (d) => ({
    subject: `Receipt: EverGuide ${d.plan === 'premium' ? 'Premium' : 'Pro'} (demo)`,
    text: `Hi ${d.firstName},\n\nThanks! This is a DEMO receipt: the payment ran in Razorpay Test Mode and no real money was charged.\n\nPlan: ${d.plan}\nAmount: ₹${(d.amountPaise / 100).toFixed(2)} (test)\nActive until: ${when(d.periodEnd)}`,
  }),
  'admin.mentor_application': (d) => ({
    to: ADMIN_INBOX,
    subject: '[Admin] New mentor application to review',
    text: `${d.firstName} applied to be a mentor. Review it in Admin → Mentors.`,
  }),
}

return $input.all().flatMap((item) => {
  const event = item.json.event
  const template = templates[event.type]
  if (!template) return []
  const email = template(event.data)
  return [
    {
      json: { to: email.to || INBOX, subject: email.subject, text: email.text, eventId: event.id },
    },
  ]
})
