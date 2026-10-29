import { expect, signIn, test } from './support/fixtures.ts'

test('journal and habits: write, search and tick a day', async ({
  page,
  person,
  consoleErrors,
}) => {
  await signIn(page, await person('Neha Singh'), '/app/wellness/journal')

  await page.getByRole('button', { name: 'New entry' }).click()
  await page.getByLabel('Title (optional)').fill('Interview prep')
  await page.getByLabel('Entry', { exact: true }).fill('Practised my STAR stories.')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.getByRole('heading', { name: 'Interview prep' })).toBeVisible()

  await page.getByRole('link', { name: 'Habits' }).click()
  await page.getByLabel('New habit').fill('Walk 10 minutes')
  await page.getByRole('button', { name: 'Add' }).click()
  const today = page.getByRole('button', { name: /\(today\)/ })
  await today.click()
  await expect(page.getByText('1-day streak')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: /\(today\)/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(consoleErrors).toEqual([])
})

test('budget: amounts are exact to the paisa and saved', async ({ page, person }) => {
  await signIn(page, await person('Kiran Das'), '/app/finance')
  const income = page.getByLabel('Monthly income (take-home)')
  await income.fill('50,000')
  await income.press('Enter')
  await page.getByLabel('New needs item', { exact: true }).fill('Rent')
  await page.getByLabel('Planned amount for the new needs item').fill('20000')
  await page.getByRole('form', { name: 'Add to Needs' }).getByRole('button').click()
  await page.getByLabel('New savings item', { exact: true }).fill('SIP')
  await page.getByLabel('Planned amount for the new savings item').fill('10000.50')
  await page.getByRole('form', { name: 'Add to Savings' }).getByRole('button').click()
  await expect(page.getByText('₹19,999.50')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Planned for SIP')).toHaveValue('10000.50')
})
