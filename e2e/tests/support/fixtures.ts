import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY!
const headers = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  'Content-Type': 'application/json',
}

/** Test setup talks to Supabase directly; retry a dropped connection rather than fail the test. */
async function supabaseAdmin(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, { ...init, headers, signal: AbortSignal.timeout(15_000) })
    } catch (error) {
      if (attempt === 3) throw error
      await new Promise((r) => setTimeout(r, 1_000 * attempt))
    }
  }
}

export type Person = { id: string; email: string; password: string; fullName: string }

/**
 * Creates a confirmed, onboarded account through Supabase's admin API (the same
 * thing signing up and finishing onboarding does) and returns how to sign in.
 */
export async function createPerson(fullName: string, { admin = false } = {}): Promise<Person> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `everguide-e2e-${stamp}@example.com`
  const password = `E2e-${crypto.randomUUID()}`
  const res = await supabaseAdmin(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  })
  if (!res.ok) throw new Error(`Couldn't create a test user (${res.status})`)
  const { id } = (await res.json()) as { id: string }
  await supabaseAdmin(`${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      life_stage: 'early_career',
      primary_goals: ['switch_careers'],
      preferred_domains: ['career'],
      skill_level: 'beginner',
      onboarding_completed_at: new Date().toISOString(),
    }),
  })
  if (admin) {
    await supabaseAdmin(`${SUPABASE_URL}/rest/v1/user_roles`, {
      method: 'POST',
      body: JSON.stringify({ user_id: id, role: 'admin' }),
    })
  }
  return { id, email, password, fullName }
}

/** Deleting the account removes its data (on delete cascade); audit rows are kept by design, so remove them too. */
export async function deletePerson(id: string) {
  await supabaseAdmin(`${SUPABASE_URL}/rest/v1/audit_events?actor_id=eq.${id}`, {
    method: 'DELETE',
  })
  await supabaseAdmin(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE' })
}

/** Signs in through the real login form and lands on `path`. */
export async function signIn(page: Page, person: Person, path = '/app') {
  await page.goto(`/login?redirect=${encodeURIComponent(path)}`)
  await page.getByLabel('Email').fill(person.email)
  await page.getByLabel('Password', { exact: true }).fill(person.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL((url) => url.pathname === path)
}

type Fixtures = {
  /** Make throwaway people; every one is deleted after the test. */
  person: (fullName: string, options?: { admin?: boolean }) => Promise<Person>
  /** A signed-in page for `person` in its own browser (separate session), closed after the test. */
  pageFor: (person: Person, path?: string) => Promise<Page>
  /** Browser errors seen during the test (expected 4xx responses excluded). */
  consoleErrors: string[]
}

export const test = base.extend<Fixtures>({
  person: async ({}, use) => {
    const made: Person[] = []
    await use(async (fullName, options) => {
      const p = await createPerson(fullName, options)
      made.push(p)
      return p
    })
    for (const p of made) await deletePerson(p.id)
  },
  pageFor: async ({ browser }, use) => {
    const opened: BrowserContext[] = []
    await use(async (person, path = '/app') => {
      const context = await browser.newContext()
      opened.push(context)
      const page = await context.newPage()
      await signIn(page, person, path)
      return page
    })
    // Pages left open would keep polling after their accounts are deleted.
    for (const context of opened) await context.close()
  },
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    await use(errors)
  },
})

export { expect }

/** True when the page scrolls sideways (content wider than the screen). */
export const overflowsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

/** Scroll through the page so scroll-triggered sections have revealed themselves. */
export async function revealAll(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight)
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y)
  }
  await page.waitForTimeout(800)
}
