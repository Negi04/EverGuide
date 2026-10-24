// Database security regression test (Phase 2 tables).
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
    if (!res.ok) throw new Error(`Could not create test user ${label}: ${res.status} ${user.msg ?? user.message ?? ''}`)
    users.push(user)
  }
  for (const user of users) {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: pub, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password }),
    })
    const session = await res.json()
    if (!res.ok) throw new Error(`Sign-in failed: ${res.status} ${session.msg ?? session.error_description ?? ''}`)
    user.token = session.access_token
  }
  const [a, b] = users
  console.log('Setup: created and signed in 2 temporary test users\n')

  console.log('— Signup trigger')
  const profile = await rest(`profiles?id=eq.${a.id}&select=full_name,updated_at`, { key: sec })
  check('Profile created automatically with name from signup', profile.data?.[0]?.full_name === 'RLS Test A')
  const prefs = await rest(`user_preferences?user_id=eq.${a.id}&select=user_id`, { key: sec })
  check('Preferences row created automatically', prefs.data?.length === 1)
  const roles = await rest(`user_roles?user_id=eq.${a.id}&select=role`, { key: sec })
  check("Default 'user' role granted (and nothing else)", roles.data?.length === 1 && roles.data[0].role === 'user')

  console.log('\n— Row isolation (RLS)')
  const own = await rest('profiles?select=id', { token: a.token })
  check('User A listing all profiles sees only their own', own.status === 200 && own.data.length === 1 && own.data[0].id === a.id, `${own.data?.length} row(s) visible`)
  const peek = await rest(`profiles?id=eq.${b.id}&select=id`, { token: a.token })
  check("User A cannot read User B's profile by id", peek.status === 200 && peek.data.length === 0)
  await rest(`profiles?id=eq.${b.id}`, { token: a.token, method: 'PATCH', body: { full_name: 'Hacked' } })
  const bName = await rest(`profiles?id=eq.${b.id}&select=full_name`, { key: sec })
  check("User A cannot rename User B", bName.data?.[0]?.full_name === 'RLS Test B')

  console.log('\n— Allowed changes')
  await new Promise((r) => setTimeout(r, 1100))
  const rename = await rest(`profiles?id=eq.${a.id}`, {
    token: a.token,
    method: 'PATCH',
    body: { full_name: 'Renamed A' },
    prefer: 'return=representation',
  })
  check('User A can update their own name', rename.status === 200 && rename.data?.[0]?.full_name === 'Renamed A', `HTTP ${rename.status}`)
  check(
    'updated_at trigger refreshed the timestamp',
    new Date(rename.data?.[0]?.updated_at) > new Date(profile.data?.[0]?.updated_at),
  )

  console.log('\n— Column-level grants')
  const createdAt = await rest(`profiles?id=eq.${a.id}`, { token: a.token, method: 'PATCH', body: { created_at: '2000-01-01T00:00:00Z' } })
  check('User A cannot change protected column created_at', denied(createdAt.status), `HTTP ${createdAt.status}`)
  const changeId = await rest(`profiles?id=eq.${a.id}`, { token: a.token, method: 'PATCH', body: { id: b.id } })
  check('User A cannot change their profile id', denied(changeId.status), `HTTP ${changeId.status}`)

  console.log('\n— Privilege escalation')
  const grantAdmin = await rest('user_roles', { token: a.token, method: 'POST', body: { user_id: a.id, role: 'admin' } })
  check('User A cannot grant themselves admin', denied(grantAdmin.status), `HTTP ${grantAdmin.status}`)
  const rolesAfter = await rest(`user_roles?user_id=eq.${a.id}&select=role`, { key: sec })
  check('User A still has only the user role', rolesAfter.data?.length === 1 && rolesAfter.data[0].role === 'user')

  console.log('\n— Server-only tables')
  const audit = await rest('audit_events?select=id', { token: a.token })
  check('Signed-in users cannot read audit_events', denied(audit.status), `HTTP ${audit.status}`)
  const contact = await rest('contact_messages', {
    token: a.token,
    method: 'POST',
    body: { name: 'Spam', email: 'spam@example.com', topic: 'general', message: 'x'.repeat(30) },
  })
  check('Signed-in users cannot write contact_messages directly', denied(contact.status), `HTTP ${contact.status}`)

  console.log('\n— Data validation in the database')
  const badSkill = await rest(`user_preferences?user_id=eq.${a.id}`, { token: a.token, method: 'PATCH', body: { skill_level: 'wizard' } })
  check('Invalid onboarding value is rejected', badSkill.status === 400, `HTTP ${badSkill.status}`)
  const badDomain = await rest(`user_preferences?user_id=eq.${a.id}`, { token: a.token, method: 'PATCH', body: { preferred_domains: ['career', 'astrology'] } })
  check('Unknown guidance domain is rejected', badDomain.status === 400, `HTTP ${badDomain.status}`)
  const goodPrefs = await rest(`user_preferences?user_id=eq.${a.id}`, {
    token: a.token,
    method: 'PATCH',
    body: { life_stage: 'college_student', skill_level: 'beginner', preferred_domains: ['career', 'finance'] },
    prefer: 'return=representation',
  })
  check('Valid onboarding answers are saved', goodPrefs.status === 200 && goodPrefs.data?.[0]?.skill_level === 'beginner', `HTTP ${goodPrefs.status}`)

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
  check('User A can mark their notification as read', markRead.status === 200 && Boolean(markRead.data?.[0]?.read_at), `HTTP ${markRead.status}`)
  const retitle = await rest(`notifications?id=eq.${notificationId}`, { token: a.token, method: 'PATCH', body: { title: 'Forged' } })
  check('User A cannot rewrite the notification text', denied(retitle.status), `HTTP ${retitle.status}`)
  const bPeek = await rest(`notifications?id=eq.${notificationId}&select=id`, { token: b.token })
  check("User B cannot see User A's notification", bPeek.status === 200 && bPeek.data.length === 0)
  const insertOwn = await rest('notifications', { token: a.token, method: 'POST', body: { user_id: a.id, type: 'x', title: 'Self-made' } })
  check('Users cannot create notifications themselves', denied(insertOwn.status), `HTTP ${insertOwn.status}`)

  console.log('\n— Anonymous visitors')
  for (const table of ['profiles', 'user_preferences', 'notifications']) {
    const anon = await rest(`${table}?select=*`)
    check(`Anonymous read of ${table} is refused`, denied(anon.status), `HTTP ${anon.status}`)
  }
} catch (error) {
  failures++
  console.log(`\nERROR  ${error.message}`)
} finally {
  console.log('\n— Cleanup')
  for (const user of users) {
    const res = await admin(`users/${user.id}`, { method: 'DELETE' })
    const left = await rest(`profiles?id=eq.${user.id}&select=id`, { key: sec })
    check('Deleting the auth user cascades to their profile data', res.ok && left.data?.length === 0, `HTTP ${res.status}`)
  }
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
  process.exitCode = failures === 0 ? 0 : 1
}
