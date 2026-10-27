import { registerSchema, type RegisterInput } from '@everguide/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
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

const callbackUrl = () => `${window.location.origin}/auth/callback`

export default function RegisterPage() {
  usePageTitle('Create your account')
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (values: RegisterInput) => {
    setFormError(null)
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      // full_name is read by the database signup trigger to create the profile.
      options: { data: { full_name: values.fullName }, emailRedirectTo: callbackUrl() },
    })
    if (error) return setFormError(authErrorMessage(error))
    // With email confirmation on there is no session yet. If an account already exists
    // for this email, Supabase answers the same way, so nobody can probe for accounts.
    if (!data.session) setSentTo(values.email)
  }

  const resend = async () => {
    if (!sentTo) return
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: sentTo,
      options: { emailRedirectTo: callbackUrl() },
    })
    if (error) setFormError(authErrorMessage(error))
    else setResent(true)
  }

  if (sentTo) {
    return (
      <div>
        <span className="inline-flex size-12 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h1 className="mt-6 text-3xl font-semibold text-ink">Check your inbox</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. Open
          it on this or any other device to activate your account.
        </p>
        <div className="mt-8 space-y-3">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}
          {resent ? (
            <FormAlert tone="success">A new link is on its way.</FormAlert>
          ) : (
            <Button variant="outline" onClick={resend}>
              Send the link again
            </Button>
          )}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          Wrong address?{' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setSentTo(null)}
          >
            Start again
          </button>
        </p>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">Start your journey</h1>
      <p className="mt-2 text-muted-foreground">
        Create a free account. We’ll ask a few questions afterwards to personalise your guidance.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}
        <FormField label="Full name" error={errors.fullName?.message}>
          <Input autoComplete="name" {...register('fullName')} />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FormField>
        <FormField
          label="Password"
          hint="At least 10 characters, with a letter and a number."
          error={errors.password?.message}
        >
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </FormField>
        <FormField label="Confirm password" error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
        </FormField>

        <div className="space-y-1.5">
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-border-strong accent-[var(--primary)]"
              aria-invalid={errors.acceptTerms ? true : undefined}
              aria-describedby={errors.acceptTerms ? 'terms-error' : undefined}
              {...register('acceptTerms')}
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" className="text-primary underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-primary underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms && (
            <p id="terms-error" role="alert" className="text-xs font-medium text-danger">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </>
  )
}
