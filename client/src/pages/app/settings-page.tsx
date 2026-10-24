import {
  newPasswordSchema,
  profileUpdateSchema,
  type NewPasswordInput,
  type ProfileUpdate,
} from '@everguide/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { authErrorMessage } from '@/auth/auth-errors'
import { useAuth } from '@/auth/use-auth'
import { FormAlert } from '@/components/common/form-alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, NativeSelect } from '@/components/ui/input'
import { domainLabels, lifeStageOptions } from '@/config/onboarding'
import { meQueryKey, useMe } from '@/hooks/use-me'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  usePageTitle('Settings')
  const { data: me } = useMe()
  if (!me) return null

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="eyebrow">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Account settings</h1>
      </header>

      <Section title="Profile">
        <ProfileForm
          fullName={me.fullName}
          timezone={me.timezone}
          email={me.email}
          userId={me.id}
        />
      </Section>

      <Section title="Guidance preferences">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Stage</dt>
            <dd className="mt-1 font-medium">
              {me.preferences.lifeStage ? lifeStageOptions[me.preferences.lifeStage].label : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Areas</dt>
            <dd className="mt-1 font-medium">
              {me.preferences.preferredDomains.map((d) => domainLabels[d]).join(', ') || '—'}
            </dd>
          </div>
        </dl>
        <Button variant="outline" size="sm" className="mt-5" asChild>
          <Link to="/onboarding">Update your answers</Link>
        </Button>
      </Section>

      <Section title="Password">
        <PasswordForm />
      </Section>

      <Section title="Sessions">
        <SessionControls />
      </Section>

      <Section title="Delete account" danger>
        <DeleteAccount />
      </Section>
    </div>
  )
}

function Section({
  title,
  danger,
  children,
}: {
  title: string
  danger?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className={`rounded-lg border bg-surface p-6 ${danger ? 'border-danger/30' : 'border-border'}`}
    >
      <h2 className={`text-lg font-semibold ${danger ? 'text-danger' : 'text-ink'}`}>{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function timeZoneOptions(current: string): string[] {
  const zones = Intl.supportedValuesOf('timeZone')
  return zones.includes(current) ? zones : [current, ...zones]
}

function ProfileForm({
  fullName,
  timezone,
  email,
  userId,
}: {
  fullName: string
  timezone: string
  email: string | null
  userId: string
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileUpdate>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { fullName, timezone },
  })

  const save = useMutation({
    mutationFn: (values: ProfileUpdate) => api.updateProfile(values),
    onSuccess: (me) => {
      queryClient.setQueryData(meQueryKey(userId), me)
      reset({ fullName: me.fullName, timezone: me.timezone })
    },
  })

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="space-y-5">
      {save.isSuccess && !isDirty && (
        <FormAlert tone="success">Your profile has been updated.</FormAlert>
      )}
      {save.isError && <FormAlert tone="error">{save.error.message}</FormAlert>}
      <FormField label="Email" hint="Your sign-in email can’t be changed here yet.">
        <Input value={email ?? ''} readOnly disabled />
      </FormField>
      <FormField label="Name" error={errors.fullName?.message}>
        <Input autoComplete="name" {...register('fullName')} />
      </FormField>
      <FormField
        label="Time zone"
        hint="Used to show mentor sessions and reminders at the right time."
        error={errors.timezone?.message}
      >
        <NativeSelect {...register('timezone')}>
          {timeZoneOptions(timezone).map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll('_', ' ')}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <Button type="submit" disabled={!isDirty || save.isPending}>
        {save.isPending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  )
}

function PasswordForm() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema) })

  const onSubmit = async ({ password }: NewPasswordInput) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setStatus({ tone: 'error', message: authErrorMessage(error) })
    reset()
    setStatus({ tone: 'success', message: 'Your password has been changed.' })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {status && <FormAlert tone={status.tone}>{status.message}</FormAlert>}
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
      <Button type="submit" variant="outline" disabled={isSubmitting}>
        {isSubmitting ? 'Changing…' : 'Change password'}
      </Button>
    </form>
  )
}

function SessionControls() {
  const { signOut } = useAuth()
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Signing out everywhere ends your sessions on every device, including this one.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => signOut('local')}>
          Sign out
        </Button>
        <Button variant="outline" onClick={() => signOut('global')}>
          Sign out on all devices
        </Button>
      </div>
    </div>
  )
}

function DeleteAccount() {
  const navigate = useNavigate()
  const [confirmation, setConfirmation] = useState('')

  const remove = useMutation({
    mutationFn: () => api.deleteAccount(),
    // The confirmation page signs out after it renders (see AccountDeletedPage).
    onSuccess: () =>
      navigate('/account-deleted', { replace: true, state: { accountDeleted: true } }),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This permanently deletes your account, profile, onboarding answers and notifications. It
        can’t be undone.
      </p>
      <Dialog onOpenChange={(open) => !open && setConfirmation('')}>
        <DialogTrigger asChild>
          <Button variant="outline" className="border-danger/40 text-danger hover:bg-danger/5">
            Delete my account
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            Everything linked to your account will be removed. Type <strong>DELETE</strong> to
            confirm.
          </DialogDescription>
          <div className="mt-5 space-y-4">
            {remove.isError && <FormAlert tone="error">{remove.error.message}</FormAlert>}
            <FormField label="Confirmation">
              <Input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </FormField>
            <div className="flex justify-end gap-3">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                className="bg-danger hover:bg-danger/90"
                disabled={confirmation !== 'DELETE' || remove.isPending}
                onClick={() => remove.mutate()}
              >
                {remove.isPending ? 'Deleting…' : 'Delete permanently'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
