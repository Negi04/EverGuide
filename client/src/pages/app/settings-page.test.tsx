import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeApi } from '@/test/fake-api'
import { fakeAuth, fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

beforeEach(() => {
  setSession(fakeSession())
})

describe('settings', () => {
  it('updates the profile name', async () => {
    const user = userEvent.setup()
    renderRoute('/app/settings')
    const name = await screen.findByLabelText(/^name$/i)
    await user.clear(name)
    await user.type(name, 'Asha R')
    await user.click(screen.getByRole('button', { name: /save profile/i }))
    expect(await screen.findByText(/profile has been updated/i)).toBeInTheDocument()
    expect(fakeApi.updateProfile).toHaveBeenCalledWith({
      fullName: 'Asha R',
      timezone: 'Asia/Kolkata',
    })
  })

  it('can sign out of every device', async () => {
    const user = userEvent.setup()
    renderRoute('/app/settings')
    await user.click(await screen.findByRole('button', { name: /sign out on all devices/i }))
    expect(fakeAuth.signOut).toHaveBeenCalledWith({ scope: 'global' })
  })

  it('deletes the account only after typing DELETE', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/app/settings')
    await user.click(await screen.findByRole('button', { name: /delete my account/i }))

    const dialog = await screen.findByRole('dialog', { name: /delete your account/i })
    const confirm = within(dialog).getByRole('button', { name: /delete permanently/i })
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByLabelText(/confirmation/i), 'DELETE')
    await user.click(confirm)

    expect(
      await screen.findByRole('heading', { name: /account has been deleted/i }),
    ).toBeInTheDocument()
    expect(fakeApi.deleteAccount).toHaveBeenCalledOnce()
    await waitFor(() => expect(fakeAuth.signOut).toHaveBeenCalledWith({ scope: 'local' }))
    // Signed out, but still on the confirmation page rather than bounced to login.
    expect(router.state.location.pathname).toBe('/account-deleted')
  })

  it('does not sign anyone out when the confirmation URL is opened directly', async () => {
    const { router } = renderRoute('/account-deleted')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(fakeAuth.signOut).not.toHaveBeenCalled()
  })
})
