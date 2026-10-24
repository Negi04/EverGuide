import { contactMessageSchema, contactTopics, type ContactMessage } from '@everguide/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router'
import { FormAlert } from '@/components/common/form-alert'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { siteConfig } from '@/config/site'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'

const topicLabels: Record<ContactMessage['topic'], string> = {
  general: 'General question',
  mentorship: 'Becoming a mentor',
  partnerships: 'Partnerships',
  support: 'Account or product support',
  privacy: 'Privacy and data requests',
}

function isTopic(value: string | null): value is ContactMessage['topic'] {
  return contactTopics.some((topic) => topic === value)
}

export default function ContactPage() {
  usePageTitle('Contact')
  const [searchParams] = useSearchParams()
  const requestedTopic = searchParams.get('topic')
  const send = useMutation({ mutationFn: (values: ContactMessage) => api.submitContact(values) })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactMessage>({
    resolver: zodResolver(contactMessageSchema),
    defaultValues: { topic: isTopic(requestedTopic) ? requestedTopic : 'general' },
  })

  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Talk to the EverGuide team."
        lead="Questions, mentor applications, partnerships or a privacy request — send us a note and tell us how we can help."
      />

      <div className="container-page grid gap-12 py-16 sm:py-20 lg:grid-cols-[1.4fr_1fr]">
        {send.isSuccess ? (
          <div>
            <FormAlert tone="success">
              Thank you — your message has been received. We’ll reply to the email address you gave
              us.
            </FormAlert>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit((values) => send.mutate(values))}
            noValidate
            className="space-y-5"
          >
            {send.isError && <FormAlert tone="error">{send.error.message}</FormAlert>}

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Your name" error={errors.name?.message}>
                <Input autoComplete="name" {...register('name')} />
              </FormField>
              <FormField label="Email" error={errors.email?.message}>
                <Input type="email" autoComplete="email" {...register('email')} />
              </FormField>
            </div>
            <FormField label="Topic" error={errors.topic?.message}>
              <NativeSelect {...register('topic')}>
                {contactTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topicLabels[topic]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Message"
              hint="Please don’t include passwords or sensitive health or financial details."
              error={errors.message?.message}
            >
              <Textarea rows={6} {...register('message')} />
            </FormField>

            <Button type="submit" size="lg" disabled={send.isPending}>
              {send.isPending ? 'Sending…' : 'Send message'}
            </Button>
          </form>
        )}

        <aside className="space-y-6 lg:border-l lg:border-border lg:pl-12">
          <div>
            <h2 className="font-sans text-sm font-semibold text-ink">Email</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {siteConfig.contact.email ?? 'A contact address will be published before launch.'}
            </p>
          </div>
          <div>
            <h2 className="font-sans text-sm font-semibold text-ink">Need urgent help?</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              EverGuide is not an emergency service. If you or someone else is in immediate danger,
              contact your local emergency number.
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
