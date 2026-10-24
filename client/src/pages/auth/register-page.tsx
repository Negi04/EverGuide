import { registerSchema, type RegisterInput } from '@everguide/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Notice } from '@/components/common/notice'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { usePageTitle } from '@/hooks/use-page-title'

export default function RegisterPage() {
  usePageTitle('Create your account')
  const [attempted, setAttempted] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  // Supabase Auth is connected in Phase 2.
  const onSubmit = () => setAttempted(true)

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">Start your journey</h1>
      <p className="mt-2 text-muted-foreground">
        Create a free account. We will ask a few questions afterwards to personalise your guidance.
      </p>

      <Notice className="mt-8">Accounts are not open yet. Registration is being connected.</Notice>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-5">
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

        <Button type="submit" size="lg" className="w-full">
          Create account
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {attempted && 'Registration is not available yet, so no account was created.'}
        </p>
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
