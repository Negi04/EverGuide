import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { findLowContrastText } from './support/contrast.ts'
import {
  createPerson,
  deletePerson,
  expect,
  revealAll,
  signIn,
  test,
  type Person,
} from './support/fixtures.ts'

const publicPages = [
  '/',
  '/features',
  '/pricing',
  '/mentors',
  '/resources',
  '/about',
  '/contact',
  '/login',
  '/register',
  '/privacy',
]
const appPages = [
  '/app',
  '/app/guide',
  '/app/career',
  '/app/career/interview',
  '/app/mentors',
  '/app/mentors/profile',
  '/app/wellness',
  '/app/wellness/journal',
  '/app/wellness/habits',
  '/app/wellness/support',
  '/app/finance',
  '/app/finance/savings',
  '/app/finance/calculators',
  '/app/finance/glossary',
  '/app/resources',
  '/app/billing',
  '/app/settings',
  '/app/admin',
  '/app/admin/users',
  '/app/admin/knowledge',
  '/app/admin/automation',
  '/app/admin/audit',
]

/** axe (WCAG 2.1 A and AA rules) plus our own contrast measurement. */
async function audit(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' })
  await revealAll(page)
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const problems = axe.violations.map(
    (v) =>
      `${v.id}: ${v.help} → ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  )
  expect.soft(problems, `axe found problems on ${path}`).toEqual([])
  expect.soft(await page.evaluate(findLowContrastText), `low-contrast text on ${path}`).toEqual([])
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`${theme} theme`, () => {
    // The theme a returning visitor chose, applied before the page's own script runs.
    const chooseTheme = (page: Page) =>
      page.addInitScript((t) => localStorage.setItem('everguide-theme', t), theme)

    for (const path of publicPages) {
      test(`${path} meets WCAG 2.1 AA`, async ({ page }) => {
        await chooseTheme(page)
        await audit(page, path)
      })
    }

    test.describe('signed in', () => {
      // One admin signs in once; each page then gets a fresh browser with that session.
      let admin: Person
      const session = `test-results/.auth-${theme}.json`

      test.beforeAll(async ({ browser }) => {
        admin = await createPerson('Audit Admin', { admin: true })
        const page = await browser.newPage()
        await signIn(page, admin)
        await page.context().storageState({ path: session })
        await page.close()
      })
      test.afterAll(async () => {
        if (admin) await deletePerson(admin.id)
      })

      for (const path of appPages) {
        test(`${path} meets WCAG 2.1 AA`, async ({ browser }) => {
          const context = await browser.newContext({ storageState: session })
          const page = await context.newPage()
          await chooseTheme(page)
          await audit(page, path)
          await context.close()
        })
      }
    })
  })
}
