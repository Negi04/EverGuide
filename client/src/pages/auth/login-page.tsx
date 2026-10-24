import { loginSchema, type LoginInput } from '@everguide/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { authErrorMessage } from '@/auth/auth-errors'
import { FormAlert } from '@/components/common/form-alert'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { usePageTitle } from '@/hooks/use-page-title'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  usePageTitle('Log in')
  const [formError, setFormError] = useState<string | null>(null)
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  // On success the auth state changes and RedirectIfSignedIn takes the user onwards.
  const onSubmit = async (values: LoginInput) => {
    setFormError(null)
    setUnconfirmedEmail(null)
    const { error } = await supabase.auth.signInWithPassword(values)
    if (!error) return
    if (error.code === 'email_not_confirmed') setUnconfirmedEmail(values.email)
    setFormError(authErrorMessage(error))
  }

  const resendConfirmation = async () => {
    if (!unconfirmedEmail) return
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: unconfirmedEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setFormError(authErrorMessage(error))
    else setResent(true)
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Log in to continue where you left off.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
        {formError && (
          <FormAlert tone="error">
            {formError}
            {unconfirmedEmail && !resent && (
              <Button
                type="button"
                variant="link"
                className="ml-1 h-auto p-0 align-baseline"
                onClick={resendConfirmation}
              >
                Send the link again
              </Button>
            )}
          </FormAlert>
        )}
        {resent && (
          <FormAlert tone="success">
            We sent a new confirmation link to {unconfirmedEmail}.
          </FormAlert>
        )}

        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </FormField>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        New to EverGuide?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  )
}
