import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderRoute } from '@/test/render-route'

describe('contact page', () => {
  it('shows field errors, linked to their inputs, when submitted empty', async () => {
    const user = userEvent.setup()
    renderRoute('/contact')
    await user.click(await screen.findByRole('button', { name: /send message/i }))

    const nameInput = screen.getByLabelText(/your name/i)
    expect(nameInput).toHaveAttribute('aria-invalid', 'true')
    expect(nameInput).toHaveAccessibleDescription(/please enter your name/i)
    expect(screen.getByLabelText(/^email$/i)).toHaveAccessibleDescription(/valid email/i)
  })

  it('preselects the topic from the URL', async () => {
    renderRoute('/contact?topic=mentorship')
    expect(await screen.findByLabelText(/topic/i)).toHaveValue('mentorship')
  })

  it('never claims a message was sent while delivery is not connected', async () => {
    const user = userEvent.setup()
    renderRoute('/contact')
    await user.type(await screen.findByLabelText(/your name/i), 'Asha')
    await user.type(screen.getByLabelText(/^email$/i), 'asha@example.com')
    await user.type(screen.getByLabelText(/message/i), 'I would like to learn about mentorship options.')
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/was not sent/i)
  })
})
