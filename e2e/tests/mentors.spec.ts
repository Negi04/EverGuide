import { expect, overflowsSideways, test } from './support/fixtures.ts'

test('mentor marketplace: apply, verify, set hours, book and confirm', async ({
  browser,
  person,
  pageFor,
}) => {
  test.setTimeout(120_000)
  const mentor = await person('Meera Iyer')
  const admin = await person('Arjun Admin', { admin: true })
  const mentee = await person('Rahul Verma')

  // The mentor applies.
  const mp = await pageFor(mentor, '/app/mentors/profile')
  await mp
    .getByLabel('Headline', { exact: true })
    .fill('Helping career switchers into data analysis')
  await mp
    .getByLabel('About you', { exact: true })
    .fill(
      'Seven years in retail analytics. I help people from support roles build a data portfolio.',
    )
  await mp.getByLabel('Data & analytics').check()
  await mp.getByLabel('Evidence link', { exact: true }).fill('https://www.linkedin.com/in/example')
  await mp.getByRole('button', { name: 'Submit application' }).click()
  await expect(mp.getByRole('heading', { name: /being reviewed/ })).toBeVisible()

  // Not public until verified.
  const before = (await (await fetch('http://localhost:4000/api/v1/mentors')).json()) as {
    id: string
  }[]
  expect(before.some((m) => m.id === mentor.id)).toBe(false)

  // An admin verifies them.
  const ap = await pageFor(admin, '/app/admin/mentors')
  await expect(ap.getByText('Meera Iyer')).toBeVisible()
  await ap.getByLabel(/Review notes/).fill('Experience checked against LinkedIn.')
  await ap.getByRole('button', { name: 'Verify mentor' }).click()
  await expect(ap.getByText('No applications waiting')).toBeVisible()

  // The mentor opens every day, all day.
  await mp.reload()
  await expect(mp.getByText('You’re a verified mentor')).toBeVisible()
  for (let i = 0; i < 7; i++) {
    await mp.getByRole('button', { name: 'Add a time window' }).click()
    await mp.getByLabel(`Day for window ${i + 1}`).selectOption(String(i + 1))
    await mp.getByLabel(`Start time for window ${i + 1}`).fill('00:00')
    await mp.getByLabel(`End time for window ${i + 1}`).fill('23:30')
  }
  await mp.getByRole('button', { name: 'Save availability' }).click()
  await expect(mp.getByText('Availability saved.')).toBeVisible()

  // The mentee books a time.
  const me = await pageFor(mentee, '/app/mentors')
  await me.getByText('Meera Iyer').click()
  // Another day than today: late in the evening, today may have few slots left.
  await me.getByRole('group', { name: 'Day' }).getByRole('button').nth(1).click()
  const times = me.getByRole('group', { name: 'Time' })
  await times.getByRole('button').nth(2).click()
  await me
    .getByLabel(/What would you like to discuss/)
    .fill('Moving from support into data analysis')
  await me.getByRole('button', { name: 'Request this time' }).click()
  await expect(me.getByText(/Request sent/)).toBeVisible()

  // The mentor confirms with a link; the mentee can join.
  await mp.goto('/app/mentors/sessions')
  await mp.getByRole('button', { name: 'Reply to request' }).click()
  await mp.getByLabel(/Meeting link/).fill('https://meet.example/everguide-e2e')
  await mp.getByRole('button', { name: 'Confirm session' }).click()
  await expect(mp.getByText('Confirmed').first()).toBeVisible()
  await me.goto('/app/mentors/sessions')
  await expect(me.getByRole('link', { name: 'Join meeting' })).toHaveAttribute(
    'href',
    'https://meet.example/everguide-e2e',
  )

  // The public profile works on a phone.
  const pub = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await pub.goto(`/mentors/${mentor.id}`)
  await expect(pub.getByRole('heading', { level: 1, name: 'Meera Iyer' })).toBeVisible()
  await expect(pub.getByRole('link', { name: 'Log in to book' })).toBeVisible()
  expect(await overflowsSideways(pub)).toBe(false)
  await pub.context().close()
})
