import { loginSchema, type LoginInput } from '@everguide/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Notice } from '@/components/common/notice'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { usePageTitle } from '@/hooks/use-page-title'

export default function LoginPage() {
  usePageTitle('Log in')
  const [attempted, setAttempted] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  // Supabase Auth is connected in Phase 2.
  const onSubmit = () => setAttempted(true)

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Log in to continue where you left off.</p>

      <Notice className="mt-8">Accounts are not open yet. Sign-in is being connected.</Notice>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-5">
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </FormField>
        <Button type="submit" size="lg" className="w-full">
          Log in
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {attempted && 'Sign-in is not available yet, so you were not logged in.'}
        </p>
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
