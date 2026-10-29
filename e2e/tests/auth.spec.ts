import { expect, signIn, test } from './support/fixtures.ts'

test.describe('signing in', () => {
  test('a private page sends visitors to log in, then back where they were going', async ({
    page,
    person,
  }) => {
    const asha = await person('Asha Rao')
    await page.goto('/app/wellness')
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.getByLabel('Email').fill(asha.email)
    await page.getByLabel('Password', { exact: true }).fill(asha.password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/app\/wellness$/)
  })

  test('a wrong password is refused with a clear message', async ({ page, person }) => {
    const asha = await person('Asha Rao')
    await page.goto('/login')
    await page.getByLabel('Email').fill(asha.email)
    await page.getByLabel('Password', { exact: true }).fill('not-the-password')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert')).toContainText('don’t match an account')
  })

  test('signing out ends the session', async ({ page, person }) => {
    const asha = await person('Asha Rao')
    await signIn(page, asha)
    await page.getByRole('button', { name: 'Sign out' }).first().click()
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login/)
  })

  test('people who are not admins cannot open the admin area', async ({ page, person }) => {
    await signIn(page, await person('Asha Rao'))
    await page.goto('/app/admin')
    await expect(page.getByRole('heading', { name: 'Administration' })).toHaveCount(0)
  })
})
