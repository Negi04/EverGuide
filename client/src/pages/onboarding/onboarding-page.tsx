import {
  guidanceDomains,
  lifeStages,
  onboardingSchema,
  primaryGoalOptions,
  skillLevels,
  type Onboarding,
  type OnboardingInput,
} from '@everguide/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm, type DefaultValues, type FieldPath } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { Logo } from '@/components/brand/logo'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { domainLabels, goalLabels, lifeStageOptions, skillLevelOptions } from '@/config/onboarding'
import { meQueryKey, useMe } from '@/hooks/use-me'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { Choice } from './choice'

type Step = { title: string; why: string; fields: FieldPath<OnboardingInput>[] }

const steps: Step[] = [
  {
    title: 'Where are you right now?',
    why: 'Advice for a student is different from advice for someone ten years into their career.',
    fields: ['lifeStage'],
  },
  {
    title: 'What would you like help with?',
    why: 'Your goals decide what your dashboard and the AI Guide focus on first. Choose up to five.',
    fields: ['primaryGoals'],
  },
  {
    title: 'Where are you headed?',
    why: 'A target role and your current level let us suggest milestones and resources at the right depth.',
    fields: ['targetCareer', 'skillLevel'],
  },
  {
    title: 'Which areas matter to you?',
    why: 'We’ll prioritise guidance and resources from these areas.',
    fields: ['preferredDomains'],
  },
]

export default function OnboardingPage() {
  usePageTitle('Personalise EverGuide')
  const me = useMe()
  if (me.isPending) return <PageLoader />
  if (me.isError) return <PageLoader label={me.error.message} />

  // Prefill previous answers when someone comes back to edit them.
  const p = me.data.preferences
  const defaults: DefaultValues<OnboardingInput> = {
    lifeStage: p.lifeStage ?? undefined,
    primaryGoals: p.primaryGoals,
    targetCareer: p.targetCareer ?? '',
    preferredDomains: p.preferredDomains,
    skillLevel: p.skillLevel ?? undefined,
  }
  return (
    <OnboardingWizard
      defaults={defaults}
      editing={Boolean(me.data.onboardingCompletedAt)}
      userId={me.data.id}
    />
  )
}

function OnboardingWizard({
  defaults,
  editing,
  userId,
}: {
  defaults: DefaultValues<OnboardingInput>
  editing: boolean
  userId: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [stepIndex, setStepIndex] = useState(0)
  const step = steps[stepIndex] ?? steps[0]!
  const isLast = stepIndex === steps.length - 1

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<OnboardingInput, unknown, Onboarding>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: defaults,
  })

  const save = useMutation({
    mutationFn: (values: Onboarding) => api.saveOnboarding(values),
    onSuccess: (me) => {
      queryClient.setQueryData(meQueryKey(userId), me)
      navigate('/app', { replace: true })
    },
  })

  const next = async () => {
    if (await trigger(step.fields)) setStepIndex((index) => index + 1)
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          {editing && (
            <Link
              to="/app"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Link>
          )}
        </div>
      </header>

      <main id="main" className="container-page py-10 sm:py-16">
        <form
          onSubmit={handleSubmit((values) => save.mutate(values))}
          noValidate
          className="mx-auto max-w-2xl"
          aria-labelledby="step-title"
        >
          <p className="text-sm font-medium text-muted-foreground">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={stepIndex + 1}
          >
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>

          <h1 id="step-title" className="mt-8 text-3xl font-semibold text-ink">
            {step.title}
          </h1>
          <p className="mt-3 flex gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
            <span>
              <span className="font-medium text-foreground">Why we ask: </span>
              {step.why}
            </span>
          </p>

          <div className="mt-8">
            {stepIndex === 0 && (
              <ChoiceGroup legend="Your stage" error={errors.lifeStage?.message}>
                {lifeStages.map((value) => (
                  <Choice
                    key={value}
                    type="radio"
                    value={value}
                    label={lifeStageOptions[value].label}
                    hint={lifeStageOptions[value].hint}
                    {...register('lifeStage')}
                  />
                ))}
              </ChoiceGroup>
            )}

            {stepIndex === 1 && (
              <ChoiceGroup
                legend="Your goals"
                error={errors.primaryGoals?.message ?? errors.primaryGoals?.root?.message}
              >
                {primaryGoalOptions.map((value) => (
                  <Choice
                    key={value}
                    type="checkbox"
                    value={value}
                    label={goalLabels[value]}
                    {...register('primaryGoals')}
                  />
                ))}
              </ChoiceGroup>
            )}

            {stepIndex === 2 && (
              <div className="space-y-8">
                <FormField
                  label="Target role or field (optional)"
                  hint="For example: data analyst, nursing, product design."
                  error={errors.targetCareer?.message}
                >
                  <Input {...register('targetCareer')} />
                </FormField>
                <ChoiceGroup legend="Your current level" error={errors.skillLevel?.message}>
                  {skillLevels.map((value) => (
                    <Choice
                      key={value}
                      type="radio"
                      value={value}
                      label={skillLevelOptions[value].label}
                      hint={skillLevelOptions[value].hint}
                      {...register('skillLevel')}
                    />
                  ))}
                </ChoiceGroup>
              </div>
            )}

            {stepIndex === 3 && (
              <ChoiceGroup
                legend="Guidance areas"
                error={errors.preferredDomains?.message ?? errors.preferredDomains?.root?.message}
              >
                {guidanceDomains.map((value) => (
                  <Choice
                    key={value}
                    type="checkbox"
                    value={value}
                    label={domainLabels[value]}
                    {...register('preferredDomains')}
                  />
                ))}
              </ChoiceGroup>
            )}
          </div>

          {save.isError && (
            <FormAlert tone="error" className="mt-6">
              {save.error.message}
            </FormAlert>
          )}

          <div className="mt-10 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStepIndex((index) => index - 1)}
              className={stepIndex === 0 ? 'invisible' : undefined}
            >
              Back
            </Button>
            {isLast ? (
              <Button type="submit" size="lg" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : editing ? 'Save answers' : 'Finish'}
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={next}>
                Continue
              </Button>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}

function ChoiceGroup({
  legend,
  error,
  children,
}: {
  legend: string
  error?: string
  children: ReactNode
}) {
  return (
    <fieldset aria-describedby={error ? 'group-error' : undefined}>
      <legend className="sr-only">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
      {error && (
        <p id="group-error" role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}
