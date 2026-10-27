import {
  mentorApplicationSchema,
  mentorExpertise,
  type AvailabilityWindow,
  type MentorApplication,
  type MyMentorProfile,
} from '@everguide/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Clock, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { expertiseLabels, weekdayLabels } from '@/config/mentors'
import { useMe } from '@/hooks/use-me'
import { mentorKeys, useMyMentorProfile } from '@/hooks/use-mentors'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { displayTimeZone } from '@/lib/format'

export default function MentorProfilePage() {
  usePageTitle('Mentor profile')
  const profile = useMyMentorProfile()

  if (profile.isPending) return <PageLoader label="Loading…" />
  if (profile.isError) return <p className="text-danger">{profile.error.message}</p>
  const p = profile.data

  if (!p) return <ApplicationForm />
  if (p.verificationStatus === 'pending') {
    return (
      <StatusCard
        icon={<Clock className="size-5" aria-hidden />}
        title="Your application is being reviewed"
      >
        Thanks for applying. A reviewer will check the evidence you shared and you’ll get a
        notification with the decision. Your profile isn’t visible to others until then.
      </StatusCard>
    )
  }
  if (p.verificationStatus === 'rejected') {
    return (
      <div className="space-y-6">
        <StatusCard
          icon={<X className="size-5" aria-hidden />}
          title="Your application wasn’t approved"
        >
          {p.latestApplication?.reviewNotes ??
            'The evidence provided wasn’t enough to verify your experience.'}{' '}
          You can update your details and apply again.
        </StatusCard>
        <ApplicationForm existing={p} />
      </div>
    )
  }
  return <VerifiedMentor profile={p} />
}

function StatusCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-4 rounded-lg border border-border bg-surface p-6">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800">
        {icon}
      </span>
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

function ApplicationForm({ existing }: { existing?: MyMentorProfile }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const form = useForm<MentorApplication>({
    resolver: zodResolver(mentorApplicationSchema),
    defaultValues: {
      headline: existing?.headline ?? '',
      bio: existing?.bio ?? '',
      jobTitle: existing?.jobTitle ?? '',
      company: existing?.company ?? '',
      yearsExperience: existing?.yearsExperience ?? 3,
      expertise: existing?.expertise ?? [],
      languages: existing?.languages ?? ['English'],
      sessionMinutes: existing?.sessionMinutes ?? 30,
      evidenceUrl: '',
      evidenceNotes: '',
    },
  })
  const [languages, setLanguages] = useState((existing?.languages ?? ['English']).join(', '))
  const apply = useMutation({
    mutationFn: (input: MentorApplication) => api.applyAsMentor(input),
    onSuccess: (profile) => queryClient.setQueryData(mentorKeys.own(user?.id), profile),
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) =>
    apply.mutate({ ...values, sessionMinutes: Number(values.sessionMinutes) as 30 | 45 | 60 }),
  )

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-5 rounded-lg border border-border bg-surface p-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-ink">Apply to become a mentor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your profile is reviewed before it appears in the directory. A job title or company name
          alone isn’t enough; share a link that shows your experience.
        </p>
      </div>
      {apply.error && <FormAlert tone="error">{apply.error.message}</FormAlert>}
      <FormField
        label="Headline"
        error={errors.headline?.message}
        hint="One line on how you can help, e.g. “Helping career switchers into data analysis”."
      >
        <Input {...form.register('headline')} />
      </FormField>
      <FormField label="About you" error={errors.bio?.message}>
        <Textarea rows={5} {...form.register('bio')} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Job title (optional)">
          <Input {...form.register('jobTitle')} />
        </FormField>
        <FormField label="Company (optional)">
          <Input {...form.register('company')} />
        </FormField>
        <FormField label="Years of experience" error={errors.yearsExperience?.message}>
          <Input type="number" min={0} max={60} {...form.register('yearsExperience')} />
        </FormField>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Areas you can help with (up to six)</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {mentorExpertise.map((e) => (
            <label key={e} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={e}
                {...form.register('expertise')}
                className="size-4 accent-[var(--primary)]"
              />
              {expertiseLabels[e]}
            </label>
          ))}
        </div>
        {errors.expertise && (
          <p role="alert" className="mt-1 text-xs font-medium text-danger">
            {errors.expertise.message ?? errors.expertise.root?.message}
          </p>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Languages" hint="Separate with commas." error={errors.languages?.message}>
          <Input
            value={languages}
            onChange={(e) => {
              setLanguages(e.target.value)
              form.setValue(
                'languages',
                e.target.value
                  .split(',')
                  .map((l) => l.trim())
                  .filter(Boolean),
              )
            }}
          />
        </FormField>
        <FormField label="Session length">
          <NativeSelect {...form.register('sessionMinutes', { valueAsNumber: true })}>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
          </NativeSelect>
        </FormField>
      </div>
      <FormField
        label="Evidence link"
        hint="For example your LinkedIn profile or a portfolio. Only reviewers see it."
        error={errors.evidenceUrl?.message}
      >
        <Input type="url" placeholder="https://" {...form.register('evidenceUrl')} />
      </FormField>
      <FormField label="Anything reviewers should know (optional)">
        <Textarea rows={3} className="min-h-20" {...form.register('evidenceNotes')} />
      </FormField>
      <Button type="submit" disabled={apply.isPending}>
        {apply.isPending ? 'Submitting…' : 'Submit application'}
      </Button>
    </form>
  )
}

function VerifiedMentor({ profile }: { profile: MyMentorProfile }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: me } = useMe()
  const setProfile = (p: MyMentorProfile) => queryClient.setQueryData(mentorKeys.own(user?.id), p)
  const toggle = useMutation({
    mutationFn: (isAccepting: boolean) => api.updateMyMentorProfile({ isAccepting }),
    onSuccess: setProfile,
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-6">
        <div>
          <p className="flex items-center gap-2 font-semibold text-ink">
            <BadgeCheck className="size-5 text-brand-600" aria-hidden /> You’re a verified mentor
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{profile.headline}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.isAccepting}
              onChange={(e) => toggle.mutate(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Taking new requests
          </label>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/mentors/${user?.id}`}>View public profile</Link>
          </Button>
        </div>
      </div>
      <AvailabilityEditor
        initial={profile.availability}
        timeZone={displayTimeZone(me?.timezone)}
        onSaved={setProfile}
      />
    </div>
  )
}

function AvailabilityEditor({
  initial,
  timeZone,
  onSaved,
}: {
  initial: AvailabilityWindow[]
  timeZone: string
  onSaved: (p: MyMentorProfile) => void
}) {
  const [windows, setWindows] = useState<AvailabilityWindow[]>(initial)
  const save = useMutation({ mutationFn: () => api.saveAvailability(windows), onSuccess: onSaved })
  const update = (index: number, patch: Partial<AvailabilityWindow>) =>
    setWindows((list) => list.map((w, i) => (i === index ? { ...w, ...patch } : w)))

  return (
    <section
      aria-labelledby="availability-title"
      className="rounded-lg border border-border bg-surface p-6"
    >
      <h2 id="availability-title" className="text-lg font-semibold text-ink">
        Weekly availability
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        In your time zone ({timeZone.replaceAll('_', ' ')}). Mentees see these times converted to
        theirs. Sessions can be booked from 2 hours ahead, up to 30 days out.
      </p>
      <ul className="mt-4 space-y-2">
        {windows.map((w, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label={`Day for window ${index + 1}`}
              value={w.weekday}
              onChange={(e) => update(index, { weekday: Number(e.target.value) })}
              className="w-40"
            >
              {Object.entries(weekdayLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
            <Input
              type="time"
              aria-label={`Start time for window ${index + 1}`}
              value={w.startTime}
              onChange={(e) => update(index, { startTime: e.target.value })}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="time"
              aria-label={`End time for window ${index + 1}`}
              value={w.endTime}
              onChange={(e) => update(index, { endTime: e.target.value })}
              className="w-32"
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove window ${index + 1}`}
              onClick={() => setWindows((list) => list.filter((_, i) => i !== index))}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        variant="link"
        className="mt-2"
        onClick={() =>
          setWindows((list) => [...list, { weekday: 1, startTime: '18:00', endTime: '20:00' }])
        }
      >
        <Plus aria-hidden /> Add a time window
      </Button>
      {save.error && (
        <FormAlert tone="error" className="mt-3">
          {save.error.message}
        </FormAlert>
      )}
      {save.isSuccess && (
        <FormAlert tone="success" className="mt-3">
          Availability saved.
        </FormAlert>
      )}
      <div className="mt-4">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save availability'}
        </Button>
      </div>
    </section>
  )
}
