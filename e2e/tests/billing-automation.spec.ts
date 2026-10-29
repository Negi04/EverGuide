import { expect, signIn, test } from './support/fixtures.ts'

test('the billing page is clearly a demo and offers both plans', async ({ page, person }) => {
  await signIn(page, await person('Aditi Rao'), '/app/billing')
  await expect(page.getByText(/no real money is charged/)).toBeVisible()
  await expect(page.getByText('4100 2800 0000 1007')).toBeVisible()
  await expect(page.getByText('Free', { exact: true })).toBeVisible()
  for (const name of ['Pay ₹199 (test)', 'Pay ₹499 (test)']) {
    await expect(page.getByRole('button', { name })).toBeVisible()
  }
})

test('a sign-up shows up as a welcome event in Admin → Automation', async ({ person, pageFor }) => {
  const admin = await person('Arjun Admin', { admin: true })
  await person('Fresh Signup')
  const page = await pageFor(admin, '/app/admin/automation')
  const events = page.getByRole('list', { name: 'Recent events' })
  await expect(events.getByText('Welcome email').first()).toBeVisible()
  await expect(
    page
      .getByText('Delivered', { exact: true })
      .or(page.getByText('Waiting', { exact: true }))
      .first(),
  ).toBeVisible()
})

// Opens Razorpay's real Test Mode checkout (network + a Razorpay test order):
// run with E2E_RAZORPAY=1.
test('paying opens Razorpay Checkout for the server’s order', async ({ page, person }) => {
  test.skip(!process.env.E2E_RAZORPAY, 'Set E2E_RAZORPAY=1 to open the real Test Mode checkout')
  await signIn(page, await person('Aditi Rao'), '/app/billing')
  await page.getByRole('button', { name: 'Pay ₹199 (test)' }).click()
  const checkout = page.frameLocator('iframe.razorpay-checkout-frame')
  await expect(checkout.getByText('₹199').first()).toBeVisible({ timeout: 40_000 })
})
