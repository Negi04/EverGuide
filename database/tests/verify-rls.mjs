// Database security regression test (Phase 2, 3 and 4 tables).
//
// Run with:  npm run db:verify
//
// Creates two temporary, pre-confirmed users in the project configured in .env,
// attempts cross-user reads/writes, privilege escalation and invalid data,
// then deletes the users again. Prints results only — never keys or tokens.
//
// Use it against development or staging projects only. It refuses to run when
// NODE_ENV=production.
process.loadEnvFile(process.argv[2] ?? '.env')
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run against a production configuration.')
  process.exit(1)
}
const url = process.env.SUPABASE_URL
const pub = process.env.SUPABASE_ANON_KEY
const sec = process.env.SUPABASE_SERVICE_ROLE_KEY

let failures = 0
const check = (name, pass, detail = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const denied = (status) => status === 401 || status === 403

async function rest(path, { key = pub, token, method = 'GET', body, prefer } = {}) {
  const headers = { apikey: key, 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (prefer) headers.Prefer = prefer
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

const admin = (path, init = {}) =>
  fetch(`${url}/auth/v1/admin/${path}`, {
    ...init,
    headers: { apikey: sec, 'Content-Type': 'application/json' },
  })

const stamp = Date.now()
const password = `Rls-${crypto.randomUUID()}`
const users = []

try {
  // --- Setup: two confirmed users, then sign in as each -----------------
  for (const label of ['A', 'B']) {
    const res = await admin('users', {
      method: 'POST',
      body: JSON.stringify({
        email: `everguide-rls-${label.toLowerCase()}-${stamp}@example.com`,
        password,
        email_confirm: true,
        user_metadata: { full_name: `RLS Test ${label}` },
      }),
    })
    const user = await res.json()
    if (!res.ok)
      throw new Error(
        `Could not create test user ${label}: ${res.status} ${user.msg ?? user.message ?? ''}`,
      )
    users.push(user)
  }
  for (const user of users) {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: pub, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password }),
    })
    const session = await res.json()
    if (!res.ok)
      throw new Error(
        `Sign-in failed: ${res.status} ${session.msg ?? session.error_description ?? ''}`,
      )
    user.token = session.access_token
  }
  const [a, b] = users
  console.log('Setup: created and signed in 2 temporary test users\n')

  console.log('— Signup trigger')
  const profile = await rest(`profiles?id=eq.${a.id}&select=full_name,updated_at`, { key: sec })
  check(
    'Profile created automatically with name from signup',
    profile.data?.[0]?.full_name === 'RLS Test A',
  )
  const prefs = await rest(`user_preferences?user_id=eq.${a.id}&select=user_id`, { key: sec })
  check('Preferences row created automatically', prefs.data?.length === 1)
  const roles = await rest(`user_roles?user_id=eq.${a.id}&select=role`, { key: sec })
  check(
    "Default 'user' role granted (and nothing else)",
    roles.data?.length === 1 && roles.data[0].role === 'user',
  )

  console.log('\n— Row isolation (RLS)')
  const own = await rest('profiles?select=id', { token: a.token })
  check(
    'User A listing all profiles sees only their own',
    own.status === 200 && own.data.length === 1 && own.data[0].id === a.id,
    `${own.data?.length} row(s) visible`,
  )
  const peek = await rest(`profiles?id=eq.${b.id}&select=id`, { token: a.token })
  check("User A cannot read User B's profile by id", peek.status === 200 && peek.data.length === 0)
  await rest(`profiles?id=eq.${b.id}`, {
    token: a.token,
    method: 'PATCH',
    body: { full_name: 'Hacked' },
  })
  const bName = await rest(`profiles?id=eq.${b.id}&select=full_name`, { key: sec })
  check('User A cannot rename User B', bName.data?.[0]?.full_name === 'RLS Test B')

  console.log('\n— Allowed changes')
  await new Promise((r) => setTimeout(r, 1100))
  const rename = await rest(`profiles?id=eq.${a.id}`, {
    token: a.token,
    method: 'PATCH',
    body: { full_name: 'Renamed A' },
    prefer: 'return=representation',
  })
  check(
    'User A can update their own name',
    rename.status === 200 && rename.data?.[0]?.full_name === 'Renamed A',
    `HTTP ${rename.status}`,
  )
  check(
    'updated_at trigger refreshed the timestamp',
    new Date(rename.data?.[0]?.updated_at) > new Date(profile.data?.[0]?.updated_at),
  )

  console.log('\n— Column-level grants')
  const createdAt = await rest(`profiles?id=eq.${a.id}`, {
    token: a.token,
    method: 'PATCH',
    body: { created_at: '2000-01-01T00:00:00Z' },
  })
  check(
    'User A cannot change protected column created_at',
    denied(createdAt.status),
    `HTTP ${createdAt.status}`,
  )
  const changeId = await rest(`profiles?id=eq.${a.id}`, {
    token: a.token,
    method: 'PATCH',
    body: { id: b.id },
  })
  check('User A cannot change their profile id', denied(changeId.status), `HTTP ${changeId.status}`)

  console.log('\n— Privilege escalation')
  const grantAdmin = await rest('user_roles', {
    token: a.token,
    method: 'POST',
    body: { user_id: a.id, role: 'admin' },
  })
  check(
    'User A cannot grant themselves admin',
    denied(grantAdmin.status),
    `HTTP ${grantAdmin.status}`,
  )
  const rolesAfter = await rest(`user_roles?user_id=eq.${a.id}&select=role`, { key: sec })
  check(
    'User A still has only the user role',
    rolesAfter.data?.length === 1 && rolesAfter.data[0].role === 'user',
  )

  console.log('\n— Server-only tables')
  const audit = await rest('audit_events?select=id', { token: a.token })
  check('Signed-in users cannot read audit_events', denied(audit.status), `HTTP ${audit.status}`)
  const contact = await rest('contact_messages', {
    token: a.token,
    method: 'POST',
    body: { name: 'Spam', email: 'spam@example.com', topic: 'general', message: 'x'.repeat(30) },
  })
  check(
    'Signed-in users cannot write contact_messages directly',
    denied(contact.status),
    `HTTP ${contact.status}`,
  )

  console.log('\n— Data validation in the database')
  const badSkill = await rest(`user_preferences?user_id=eq.${a.id}`, {
    token: a.token,
    method: 'PATCH',
    body: { skill_level: 'wizard' },
  })
  check('Invalid onboarding value is rejected', badSkill.status === 400, `HTTP ${badSkill.status}`)
  const badDomain = await rest(`user_preferences?user_id=eq.${a.id}`, {
    token: a.token,
    method: 'PATCH',
    body: { preferred_domains: ['career', 'astrology'] },
  })
  check('Unknown guidance domain is rejected', badDomain.status === 400, `HTTP ${badDomain.status}`)
  const goodPrefs = await rest(`user_preferences?user_id=eq.${a.id}`, {
    token: a.token,
    method: 'PATCH',
    body: {
      life_stage: 'college_student',
      skill_level: 'beginner',
      preferred_domains: ['career', 'finance'],
    },
    prefer: 'return=representation',
  })
  check(
    'Valid onboarding answers are saved',
    goodPrefs.status === 200 && goodPrefs.data?.[0]?.skill_level === 'beginner',
    `HTTP ${goodPrefs.status}`,
  )

  console.log('\n— Notifications')
  const created = await rest('notifications', {
    key: sec,
    method: 'POST',
    body: { user_id: a.id, type: 'test', title: 'Welcome' },
    prefer: 'return=representation',
  })
  const notificationId = created.data?.[0]?.id
  const markRead = await rest(`notifications?id=eq.${notificationId}`, {
    token: a.token,
    method: 'PATCH',
    body: { read_at: new Date().toISOString() },
    prefer: 'return=representation',
  })
  check(
    'User A can mark their notification as read',
    markRead.status === 200 && Boolean(markRead.data?.[0]?.read_at),
    `HTTP ${markRead.status}`,
  )
  const retitle = await rest(`notifications?id=eq.${notificationId}`, {
    token: a.token,
    method: 'PATCH',
    body: { title: 'Forged' },
  })
  check(
    'User A cannot rewrite the notification text',
    denied(retitle.status),
    `HTTP ${retitle.status}`,
  )
  const bPeek = await rest(`notifications?id=eq.${notificationId}&select=id`, { token: b.token })
  check("User B cannot see User A's notification", bPeek.status === 200 && bPeek.data.length === 0)
  const insertOwn = await rest('notifications', {
    token: a.token,
    method: 'POST',
    body: { user_id: a.id, type: 'x', title: 'Self-made' },
  })
  check(
    'Users cannot create notifications themselves',
    denied(insertOwn.status),
    `HTTP ${insertOwn.status}`,
  )

  console.log('\n— Anonymous visitors')
  for (const table of ['profiles', 'user_preferences', 'notifications']) {
    const anon = await rest(`${table}?select=*`)
    check(`Anonymous read of ${table} is refused`, denied(anon.status), `HTTP ${anon.status}`)
  }

  // ===================== Phase 3: AI Guide tables =====================
  console.log('\n— Conversations (Phase 3)')
  const conv = await rest('conversations', {
    token: a.token,
    method: 'POST',
    body: { user_id: a.id, title: 'My plan', domain: 'career' },
    prefer: 'return=representation',
  })
  check('User A can start their own conversation', conv.status === 201, `HTTP ${conv.status}`)
  const convId = conv.data?.[0]?.id
  const forgedConv = await rest('conversations', {
    token: a.token,
    method: 'POST',
    body: { user_id: b.id, title: 'Not mine' },
  })
  check(
    'User A cannot create a conversation owned by User B',
    denied(forgedConv.status),
    `HTTP ${forgedConv.status}`,
  )
  const bSeesConv = await rest(`conversations?id=eq.${convId}&select=id`, { token: b.token })
  check(
    "User B cannot see User A's conversation",
    bSeesConv.status === 200 && bSeesConv.data.length === 0,
  )
  await rest(`conversations?id=eq.${convId}`, {
    token: b.token,
    method: 'PATCH',
    body: { title: 'Hijacked' },
  })
  await rest(`conversations?id=eq.${convId}`, { token: b.token, method: 'DELETE' })
  const convAfter = await rest(`conversations?id=eq.${convId}&select=title`, { key: sec })
  check(
    "User B cannot rename or delete User A's conversation",
    convAfter.data?.[0]?.title === 'My plan',
  )
  const renameConv = await rest(`conversations?id=eq.${convId}`, {
    token: a.token,
    method: 'PATCH',
    body: { title: 'Renamed plan' },
    prefer: 'return=representation',
  })
  check(
    'User A can rename their conversation',
    renameConv.status === 200 && renameConv.data?.[0]?.title === 'Renamed plan',
  )

  console.log('\n— Messages can only be written by the server')
  const forgedMsg = await rest('messages', {
    token: a.token,
    method: 'POST',
    body: { conversation_id: convId, user_id: a.id, role: 'assistant', content: 'Fake AI answer' },
  })
  check(
    'User A cannot insert a fake AI message',
    denied(forgedMsg.status),
    `HTTP ${forgedMsg.status}`,
  )
  const userMsg = await rest('messages', {
    key: sec,
    method: 'POST',
    body: { conversation_id: convId, user_id: a.id, role: 'user', content: 'How do I start?' },
    prefer: 'return=representation',
  })
  const aiMsg = await rest('messages', {
    key: sec,
    method: 'POST',
    body: {
      conversation_id: convId,
      user_id: a.id,
      role: 'assistant',
      content: 'Start small.',
      grounded: true,
    },
    prefer: 'return=representation',
  })
  const aiMsgId = aiMsg.data?.[0]?.id
  check('The server can store messages', userMsg.status === 201 && aiMsg.status === 201)
  const mismatched = await rest('messages', {
    key: sec,
    method: 'POST',
    body: { conversation_id: convId, user_id: b.id, role: 'user', content: 'Wrong owner' },
  })
  check(
    "Even the server cannot attach User B's message to User A's conversation",
    mismatched.status === 409,
    `HTTP ${mismatched.status}`,
  )
  const aReads = await rest(`messages?conversation_id=eq.${convId}&select=id`, { token: a.token })
  check('User A can read their messages', aReads.status === 200 && aReads.data.length === 2)
  const bReads = await rest(`messages?conversation_id=eq.${convId}&select=id`, { token: b.token })
  check("User B cannot read User A's messages", bReads.status === 200 && bReads.data.length === 0)
  const editMsg = await rest(`messages?id=eq.${aiMsgId}`, {
    token: a.token,
    method: 'PATCH',
    body: { content: 'Edited answer' },
  })
  check('User A cannot edit an AI answer', denied(editMsg.status), `HTTP ${editMsg.status}`)

  console.log('\n— Citations, usage and the knowledge base')
  const forgedCitation = await rest('message_citations', {
    token: a.token,
    method: 'POST',
    body: {
      message_id: aiMsgId,
      user_id: a.id,
      citation_number: 1,
      title: 'Fake',
      source_name: 'Fake',
      excerpt: 'x',
      similarity: 1,
    },
  })
  check(
    'User A cannot add a fake citation',
    denied(forgedCitation.status),
    `HTTP ${forgedCitation.status}`,
  )
  const reserve = await rest('rpc/reserve_ai_message', {
    key: sec,
    method: 'POST',
    body: { p_user_id: a.id, p_monthly_limit: 30 },
  })
  const reservationId = reserve.data?.[0]?.reservation_id
  check('The server can reserve AI usage', Boolean(reservationId))
  const resetUsage = await rest(`ai_usage?id=eq.${reservationId}`, {
    token: a.token,
    method: 'PATCH',
    body: { status: 'failed' },
  })
  check(
    'User A cannot change their usage records',
    denied(resetUsage.status),
    `HTTP ${resetUsage.status}`,
  )
  const deleteUsage = await rest(`ai_usage?id=eq.${reservationId}`, {
    token: a.token,
    method: 'DELETE',
  })
  check(
    'User A cannot delete their usage records',
    denied(deleteUsage.status),
    `HTTP ${deleteUsage.status}`,
  )
  const ownUsage = await rest('ai_usage?select=id', { token: a.token })
  check('User A can see their own usage', ownUsage.status === 200 && ownUsage.data.length === 1)
  const selfReserve = await rest('rpc/reserve_ai_message', {
    token: a.token,
    method: 'POST',
    body: { p_user_id: a.id, p_monthly_limit: 1000 },
  })
  check(
    'Users cannot call the quota function themselves',
    selfReserve.status >= 400,
    `HTTP ${selfReserve.status}`,
  )
  const kb = await rest('knowledge_documents?select=id', { token: a.token })
  check(
    'Users cannot read the knowledge base tables directly',
    denied(kb.status),
    `HTTP ${kb.status}`,
  )

  console.log('\n— Usage limit under concurrent requests')
  const burst = await Promise.all(
    Array.from({ length: 10 }, () =>
      rest('rpc/reserve_ai_message', {
        key: sec,
        method: 'POST',
        body: { p_user_id: b.id, p_monthly_limit: 3 },
      }),
    ),
  )
  const granted = burst.filter((r) => r.data?.[0]?.reservation_id).length
  check(
    '10 simultaneous requests against a limit of 3 get exactly 3 reservations',
    granted === 3,
    `${granted} granted`,
  )

  console.log('\n— Feedback')
  const rateOwn = await rest('ai_feedback', {
    token: a.token,
    method: 'POST',
    body: { message_id: aiMsgId, user_id: a.id, rating: 'helpful' },
  })
  check(
    'User A can rate an AI answer in their conversation',
    rateOwn.status === 201,
    `HTTP ${rateOwn.status}`,
  )
  const rateUserMsg = await rest('ai_feedback', {
    token: a.token,
    method: 'POST',
    body: { message_id: userMsg.data?.[0]?.id, user_id: a.id, rating: 'helpful' },
  })
  check(
    'User A cannot rate their own question (only AI answers)',
    denied(rateUserMsg.status),
    `HTTP ${rateUserMsg.status}`,
  )
  const rateAsB = await rest('ai_feedback', {
    token: b.token,
    method: 'POST',
    body: { message_id: aiMsgId, user_id: b.id, rating: 'not_helpful' },
  })
  check("User B cannot rate User A's answers", denied(rateAsB.status), `HTTP ${rateAsB.status}`)

  console.log('\n— Deleting a conversation')
  const del = await rest(`conversations?id=eq.${convId}`, { token: a.token, method: 'DELETE' })
  const leftover = await rest(`messages?conversation_id=eq.${convId}&select=id`, { key: sec })
  check(
    'Deleting a conversation removes its messages',
    del.status === 204 && leftover.data?.length === 0,
    `HTTP ${del.status}`,
  )

  // ===================== Phase 4: career and mentors =====================
  console.log('\n— Goals (Phase 4)')
  const goal = await rest('goals', {
    token: a.token,
    method: 'POST',
    body: { user_id: a.id, title: 'Become a data analyst' },
    prefer: 'return=representation',
  })
  check('User A can create a goal', goal.status === 201, `HTTP ${goal.status}`)
  const goalId = goal.data?.[0]?.id
  const bGoal = await rest(`goals?id=eq.${goalId}&select=id`, { token: b.token })
  check("User B cannot see User A's goal", bGoal.status === 200 && bGoal.data.length === 0)
  const sneakyMilestone = await rest('milestones', {
    token: b.token,
    method: 'POST',
    body: { goal_id: goalId, user_id: b.id, title: 'Sneaky' },
  })
  check(
    "User B cannot add a milestone to User A's goal",
    sneakyMilestone.status >= 400,
    `HTTP ${sneakyMilestone.status}`,
  )

  console.log('\n— Private resume storage')
  const bucket = await fetch(`${url}/storage/v1/bucket/resumes`, {
    headers: { apikey: sec, Authorization: `Bearer ${sec}` },
  })
  const bucketInfo = bucket.ok ? await bucket.json() : null
  check(
    'The resumes bucket exists and is private',
    bucketInfo?.public === false,
    `HTTP ${bucket.status}`,
  )
  const upload = await fetch(`${url}/storage/v1/object/resumes/${a.id}/direct.pdf`, {
    method: 'POST',
    headers: { apikey: pub, Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/pdf' },
    body: '%PDF-1.4 test',
  })
  check(
    'Users cannot upload to the resumes bucket directly',
    upload.status >= 400,
    `HTTP ${upload.status}`,
  )
  const forgedResume = await rest('resumes', {
    token: a.token,
    method: 'POST',
    body: {
      user_id: a.id,
      file_name: 'cv.pdf',
      storage_path: 'x/cv.pdf',
      size_bytes: 10,
      page_count: 1,
      extracted_text: 'x',
    },
  })
  check(
    'Users cannot create resume records themselves',
    denied(forgedResume.status),
    `HTTP ${forgedResume.status}`,
  )

  console.log('\n— Mentors and bookings')
  // A is a verified mentor (as an admin approval would leave it); B is a mentee.
  await rest('mentor_profiles', {
    key: sec,
    method: 'POST',
    body: {
      user_id: a.id,
      headline: 'Senior data analyst',
      bio: 'I help people move into data analysis from other careers and roles.',
      years_experience: 6,
      expertise: ['data_analytics'],
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
    },
  })
  await rest('mentor_availability', {
    key: sec,
    method: 'POST',
    body: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      mentor_id: a.id,
      weekday,
      start_time: '00:00',
      end_time: '23:30',
    })),
  })
  const selfVerify = await rest(`mentor_profiles?user_id=eq.${a.id}`, {
    token: a.token,
    method: 'PATCH',
    body: { verification_status: 'rejected' },
  })
  check(
    'Mentors cannot change their own verification status',
    denied(selfVerify.status),
    `HTTP ${selfVerify.status}`,
  )
  const publicMentor = await rest(`mentor_profiles?user_id=eq.${a.id}&select=user_id`)
  check(
    'Anonymous visitors can see a verified mentor',
    publicMentor.status === 200 && publicMentor.data.length === 1,
    `HTTP ${publicMentor.status}`,
  )

  const slots = await rest('rpc/mentor_open_slots', {
    token: b.token,
    method: 'POST',
    body: { p_mentor_id: a.id, p_days: 3 },
  })
  check(
    'Open slots are computed for the verified mentor',
    slots.status === 200 && slots.data.length > 0,
    `${slots.data?.length} slots`,
  )
  const slot = slots.data?.[0]
  const book = await rest('rpc/request_booking', {
    token: b.token,
    method: 'POST',
    body: { p_mentor_id: a.id, p_starts_at: slot?.starts_at, p_topic: 'Moving into data analysis' },
  })
  check(
    'User B can request a session',
    book.status === 200 && typeof book.data === 'string',
    `HTTP ${book.status}`,
  )
  const bookingId = book.data
  const again = await rest('rpc/request_booking', {
    token: b.token,
    method: 'POST',
    body: { p_mentor_id: a.id, p_starts_at: slot?.starts_at, p_topic: 'Asking for the same slot' },
  })
  check('The same slot cannot be booked twice', again.status >= 400, `HTTP ${again.status}`)
  const overlap = await rest('bookings', {
    key: sec,
    method: 'POST',
    body: {
      mentor_id: a.id,
      mentee_id: b.id,
      starts_at: slot?.starts_at,
      ends_at: slot?.ends_at,
      topic: 'Direct overlapping insert',
    },
  })
  check(
    'Even the server cannot insert an overlapping booking (btree_gist constraint)',
    overlap.data?.code === '23P01',
    `HTTP ${overlap.status} ${overlap.data?.code}: ${overlap.data?.message}`,
  )
  const directBooking = await rest('bookings', {
    token: b.token,
    method: 'POST',
    body: {
      mentor_id: a.id,
      mentee_id: b.id,
      starts_at: slot?.starts_at,
      ends_at: slot?.ends_at,
      topic: 'Direct insert attempt',
    },
  })
  check(
    'Users cannot write bookings directly',
    denied(directBooking.status),
    `HTTP ${directBooking.status}`,
  )
  const menteeConfirms = await rest('rpc/respond_to_booking', {
    token: b.token,
    method: 'POST',
    body: { p_booking_id: bookingId, p_accept: true, p_meeting_url: 'https://meet.example/x' },
  })
  check(
    'Only the mentor can confirm a booking',
    menteeConfirms.status >= 400,
    `HTTP ${menteeConfirms.status}`,
  )
  const confirm = await rest('rpc/respond_to_booking', {
    token: a.token,
    method: 'POST',
    body: { p_booking_id: bookingId, p_accept: true, p_meeting_url: 'https://meet.example/x' },
  })
  check(
    'The mentor can confirm with a meeting link',
    confirm.status === 204 || confirm.status === 200,
    `HTTP ${confirm.status}`,
  )
  const menteeNotes = await rest('notifications?select=type', { token: b.token })
  check(
    'The mentee is notified of the confirmation',
    menteeNotes.data?.some((n) => n.type === 'booking.confirmed'),
  )
  const earlyReview = await rest('rpc/submit_mentor_review', {
    token: b.token,
    method: 'POST',
    body: { p_booking_id: bookingId, p_rating: 5 },
  })
  check(
    'A session cannot be reviewed before it happens',
    earlyReview.status >= 400,
    `HTTP ${earlyReview.status}`,
  )
  const anonBook = await rest('rpc/request_booking', {
    method: 'POST',
    body: {
      p_mentor_id: a.id,
      p_starts_at: slots.data?.[5]?.starts_at,
      p_topic: 'Anonymous booking attempt',
    },
  })
  check('Anonymous visitors cannot book', anonBook.status >= 400, `HTTP ${anonBook.status}`)
} catch (error) {
  failures++
  console.log(`\nERROR  ${error.message}`)
} finally {
  console.log('\n— Cleanup')
  for (const user of users) {
    const res = await admin(`users/${user.id}`, { method: 'DELETE' })
    const left = await rest(`profiles?id=eq.${user.id}&select=id`, { key: sec })
    check(
      'Deleting the auth user cascades to their profile data',
      res.ok && left.data?.length === 0,
      `HTTP ${res.status}`,
    )
  }
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
  process.exitCode = failures === 0 ? 0 : 1
}
