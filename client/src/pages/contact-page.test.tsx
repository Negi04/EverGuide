import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import { fakeApi } from '@/test/fake-api'
import { renderRoute } from '@/test/render-route'

async function fillValidMessage() {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText(/your name/i), 'Asha')
  await user.type(screen.getByLabelText(/^email$/i), 'asha@example.com')
  await user.type(
    screen.getByLabelText(/message/i),
    'I would like to learn about mentorship options.',
  )
  await user.click(screen.getByRole('button', { name: /send message/i }))
}

describe('contact page', () => {
  it('shows field errors, linked to their inputs, when submitted empty', async () => {
    const user = userEvent.setup()
    renderRoute('/contact')
    await user.click(await screen.findByRole('button', { name: /send message/i }))

    const nameInput = screen.getByLabelText(/your name/i)
    expect(nameInput).toHaveAttribute('aria-invalid', 'true')
    expect(nameInput).toHaveAccessibleDescription(/please enter your name/i)
    expect(fakeApi.submitContact).not.toHaveBeenCalled()
  })

  it('preselects the topic from the URL', async () => {
    renderRoute('/contact?topic=mentorship')
    expect(await screen.findByLabelText(/topic/i)).toHaveValue('mentorship')
  })

  it('sends a valid message to the API and confirms it', async () => {
    renderRoute('/contact')
    await fillValidMessage()
    expect(await screen.findByText(/your message has been received/i)).toBeInTheDocument()
    expect(fakeApi.submitContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Asha', email: 'asha@example.com', topic: 'general' }),
    )
  })

  it('shows the server’s message when sending is refused', async () => {
    fakeApi.submitContact.mockRejectedValue(
      new ApiError(429, 'rate_limited', 'Too many requests. Please wait a little and try again.'),
    )
    renderRoute('/contact')
    await fillValidMessage()
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i)
    expect(screen.queryByText(/has been received/i)).not.toBeInTheDocument()
  })
})
