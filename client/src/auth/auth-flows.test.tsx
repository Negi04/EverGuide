import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi, fakeMe } from '@/test/fake-api'
import { fakeAuth, fakeSession, setSession, setUrlAuthError } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

const authError = (code: string) =>
  Object.assign(new Error(code), { __isAuthError: true, name: 'AuthApiError', code, status: 400 })

describe('route guards', () => {
  it('sends signed-out visitors to login, remembering where they were going', async () => {
    const { router } = renderRoute('/app/settings')
    await screen.findByRole('heading', { name: /welcome back/i })
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe(`?redirect=${encodeURIComponent('/app/settings')}`)
  })

  it('sends signed-in users who have not onboarded to onboarding', async () => {
    setSession(fakeSession())
    fakeApi.getMe.mockResolvedValue(fakeMe({ onboardingCompletedAt: null }))
    const { router } = renderRoute('/app')
    await screen.findByRole('heading', { name: /where are you right now/i })
    expect(router.state.location.pathname).toBe('/onboarding')
  })

  it('shows the dashboard with the user’s own data once onboarded', async () => {
    setSession(fakeSession())
    renderRoute('/app')
    expect(await screen.findByRole('heading', { name: /welcome, asha/i })).toBeInTheDocument()
    expect(screen.getByText(/working towards: data analyst/i)).toBeInTheDocument()
    expect(screen.getByText(/find my first job/i)).toBeInTheDocument()
  })

  it('offers a retry when the account cannot be loaded', async () => {
    setSession(fakeSession())
    fakeApi.getMe.mockRejectedValue(new Error('We could not reach EverGuide.'))
    renderRoute('/app')
    expect(
      await screen.findByRole('heading', { name: /couldn’t load your account/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})

describe('login', () => {
  async function logIn(email = 'asha@example.com', password = 'correct-horse-1') {
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/^email$/i), email)
    await user.type(screen.getByLabelText(/^password$/i), password)
    await user.click(screen.getByRole('button', { name: /^log in$/i }))
  }

  it('signs in and continues to the page the user asked for', async () => {
    fakeAuth.signInWithPassword.mockImplementation(async () => {
      setSession(fakeSession())
      return { data: {}, error: null }
    })
    const { router } = renderRoute('/login?redirect=%2Fapp%2Fsettings')
    await logIn()
    await screen.findByRole('heading', { name: /account settings/i })
    expect(router.state.location.pathname).toBe('/app/settings')
  })

  it('ignores redirects to other websites', async () => {
    fakeAuth.signInWithPassword.mockImplementation(async () => {
      setSession(fakeSession())
      return { data: {}, error: null }
    })
    const { router } = renderRoute('/login?redirect=https%3A%2F%2Fevil.example')
    await logIn()
    await screen.findByRole('heading', { name: /welcome, asha/i })
    expect(router.state.location.pathname).toBe('/app')
  })

  it('explains wrong credentials without saying which part was wrong', async () => {
    fakeAuth.signInWithPassword.mockResolvedValue({
      data: {},
      error: authError('invalid_credentials'),
    })
    renderRoute('/login')
    await logIn()
    expect(await screen.findByRole('alert')).toHaveTextContent(/email and password don’t match/i)
  })

  it('offers to resend the confirmation email for unconfirmed accounts', async () => {
    fakeAuth.signInWithPassword.mockResolvedValue({
      data: {},
      error: authError('email_not_confirmed'),
    })
    renderRoute('/login')
    await logIn()
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: /send the link again/i }))
    expect(fakeAuth.resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'signup', email: 'asha@example.com' }),
    )
    expect(await screen.findByText(/sent a new confirmation link/i)).toBeInTheDocument()
  })
})

describe('registration', () => {
  it('creates the account with the name and shows the check-your-inbox step', async () => {
    const user = userEvent.setup()
    renderRoute('/register')
    await user.type(await screen.findByLabelText(/full name/i), 'Asha Rao')
    await user.type(screen.getByLabelText(/^email$/i), 'asha@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'strong-pass-123')
    await user.type(screen.getByLabelText(/confirm password/i), 'strong-pass-123')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('heading', { name: /check your inbox/i })).toBeInTheDocument()
    expect(fakeAuth.signUp).toHaveBeenCalledWith({
      email: 'asha@example.com',
      password: 'strong-pass-123',
      options: {
        data: { full_name: 'Asha Rao' },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  })

  it('does not call Supabase when the form is invalid', async () => {
    const user = userEvent.setup()
    renderRoute('/register')
    await user.click(await screen.findByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/accept the terms/i)).toBeInTheDocument()
    expect(fakeAuth.signUp).not.toHaveBeenCalled()
  })
})

describe('password reset', () => {
  it('always answers neutrally so it cannot reveal which emails have accounts', async () => {
    fakeAuth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: authError('user_not_found'),
    })
    const user = userEvent.setup()
    renderRoute('/forgot-password')
    await user.type(await screen.findByLabelText(/^email$/i), 'nobody@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(
      await screen.findByText(/if an account exists for nobody@example.com/i),
    ).toBeInTheDocument()
  })

  it('explains an expired reset link', async () => {
    setUrlAuthError('Email link is invalid or has expired')
    renderRoute('/reset-password')
    expect(
      await screen.findByRole('heading', { name: /this link has expired/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/email link is invalid or has expired/i)).toBeInTheDocument()
    setUrlAuthError(null)
  })

  it('lets a user arriving from the email set a new password', async () => {
    setSession(fakeSession(), 'PASSWORD_RECOVERY')
    const user = userEvent.setup()
    renderRoute('/reset-password')
    await user.type(await screen.findByLabelText(/^new password$/i), 'brand-new-pass-9')
    await user.type(screen.getByLabelText(/confirm new password/i), 'brand-new-pass-9')
    await user.click(screen.getByRole('button', { name: /save new password/i }))
    expect(await screen.findByText(/password has been updated/i)).toBeInTheDocument()
    expect(fakeAuth.updateUser).toHaveBeenCalledWith({ password: 'brand-new-pass-9' })
  })
})

describe('signing out', () => {
  it('returns the user to the login page and clears their cached data', async () => {
    setSession(fakeSession())
    const { router, queryClient } = renderRoute('/app')
    await screen.findByRole('heading', { name: /welcome, asha/i })

    const [sidebarSignOut] = screen.getAllByRole('button', { name: /sign out/i })
    await act(async () => {
      sidebarSignOut?.click()
    })

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})
