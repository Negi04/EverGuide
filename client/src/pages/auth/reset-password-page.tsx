import { newPasswordSchema, type NewPasswordInput } from '@everguide/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { authErrorMessage } from '@/auth/auth-errors'
import { useAuth } from '@/auth/use-auth'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { usePageTitle } from '@/hooks/use-page-title'
import { supabase, urlAuthError } from '@/lib/supabase'

/** Reached from the reset email: the link signs the user in, then they choose a new password. */
export default function ResetPasswordPage() {
  usePageTitle('Choose a new password')
  const { status } = useAuth()
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema) })

  const onSubmit = async ({ password }: NewPasswordInput) => {
    setFormError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setFormError(authErrorMessage(error))
    else setDone(true)
  }

  if (status === 'loading') return <PageLoader />

  if (status === 'signed-out') {
    return (
      <>
        <h1 className="text-3xl font-semibold text-ink">This link has expired</h1>
        <p className="mt-3 text-muted-foreground">
          {urlAuthError ?? 'Password reset links work once and only for a short time.'} Request a
          new one to continue.
        </p>
        <Button className="mt-8" asChild>
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </>
    )
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">Choose a new password</h1>
      {done ? (
        <div className="mt-8 space-y-6">
          <FormAlert tone="success">Your password has been updated.</FormAlert>
          <Button asChild>
            <Link to="/app">Continue to your dashboard</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}
          <FormField
            label="New password"
            hint="At least 10 characters, with a letter and a number."
            error={errors.password?.message}
          >
            <Input type="password" autoComplete="new-password" {...register('password')} />
          </FormField>
          <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
          </FormField>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      )}
    </>
  )
}
