import { expect, overflowsSideways, test } from './support/fixtures.ts'

const pages = [
  '/',
  '/features',
  '/pricing',
  '/mentors',
  '/resources',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/login',
  '/register',
]

test.describe('public site', () => {
  for (const path of pages) {
    test(`${path} loads with a heading, no errors and no sideways scroll on a phone`, async ({
      page,
      consoleErrors,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await overflowsSideways(page)).toBe(false)
      expect(consoleErrors).toEqual([])
    })
  }

  test('an unknown address shows the not-found page', async ({ page }) => {
    await page.goto('/no-such-page')
    await expect(page.getByText('404')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'This page took a different path.',
    )
  })

  test('the inline theme script runs (allowed by the security policy) and the choice sticks', async ({
    page,
    consoleErrors,
  }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: 'Switch to light theme' }).first().click()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(consoleErrors).toEqual([])
  })

  test('pricing labels paid plans as a demo', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByText('Demo price')).toHaveCount(2)
    await expect(page.getByText(/no real money is ever charged/)).toBeVisible()
  })
})
