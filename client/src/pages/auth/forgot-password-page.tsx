import { forgotPasswordSchema, type ForgotPasswordInput } from '@everguide/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAuthError } from '@supabase/auth-js'
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

export default function ForgotPasswordPage() {
  usePageTitle('Reset your password')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = async ({ email }: ForgotPasswordInput) => {
    setFormError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    // Only rate limits are shown. Any other outcome gets the same neutral message,
    // so this page can't be used to find out which emails have accounts.
    if (error && isAuthError(error) && error.code?.startsWith('over_')) {
      return setFormError(authErrorMessage(error))
    }
    setSentTo(email)
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">Reset your password</h1>
      <p className="mt-2 text-muted-foreground">
        Enter your email and we’ll send you a link to choose a new password.
      </p>

      {sentTo ? (
        <FormAlert tone="success" className="mt-8">
          If an account exists for {sentTo}, a reset link is on its way. The link works once and
          expires after a short time.
        </FormAlert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}
          <FormField label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" {...register('email')} />
          </FormField>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  )
}
