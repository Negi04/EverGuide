import { guidanceDomains, type GuidanceDomain } from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { FormAlert } from '@/components/common/form-alert'
import { starterQuestions } from '@/config/guide'
import { domainLabels } from '@/config/onboarding'
import { aiKeys } from '@/hooks/use-ai'
import { useMe } from '@/hooks/use-me'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Composer } from './composer'
import { Disclaimer, UsageNote } from './workspace-notes'

export default function NewConversationPage() {
  const { data: me } = useMe()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [domain, setDomain] = useState<GuidanceDomain>(
    me?.preferences.preferredDomains[0] ?? 'career',
  )

  const start = useMutation({
    mutationFn: async (question: string) => ({
      conversation: await api.createConversation(domain),
      question,
    }),
    onSuccess: ({ conversation, question }) => {
      void queryClient.invalidateQueries({ queryKey: aiKeys.allConversations(user?.id) })
      // The conversation page sends the first question once it has loaded.
      navigate(`/app/guide/${conversation.id}`, { state: { question } })
    },
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:py-14">
        <span className="inline-flex size-11 items-center justify-center rounded-md bg-ink text-brand-300">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <h1 className="mt-5 text-3xl font-semibold text-ink">What would you like guidance on?</h1>
        <p className="mt-2 text-muted-foreground">
          Answers are based on EverGuide’s guides, with numbered sources you can open.
        </p>

        <fieldset className="mt-8">
          <legend className="text-sm font-medium text-foreground">Focus area</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {guidanceDomains.map((value) => (
              <label
                key={value}
                className={cn(
                  'cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                  domain === value
                    ? 'border-primary bg-brand-50 text-brand-700'
                    : 'border-border bg-surface text-muted-foreground hover:text-foreground',
                )}
              >
                <input
                  type="radio"
                  name="domain"
                  value={value}
                  checked={domain === value}
                  onChange={() => setDomain(value)}
                  className="sr-only"
                />
                {domainLabels[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <h2 className="mt-8 text-sm font-medium text-foreground">Try asking</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {starterQuestions[domain].map((question) => (
            <li key={question}>
              <button
                type="button"
                disabled={start.isPending}
                onClick={() => start.mutate(question)}
                className="h-full w-full rounded-md border border-border bg-surface p-3 text-left text-sm text-foreground hover:border-primary disabled:opacity-60"
              >
                {question}
              </button>
            </li>
          ))}
        </ul>

        {start.isError && (
          <FormAlert tone="error" className="mt-6">
            {start.error.message}
          </FormAlert>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-3xl space-y-2">
          <Composer onSend={(text) => start.mutate(text)} busy={start.isPending} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Disclaimer />
            <UsageNote />
          </div>
        </div>
      </div>
    </div>
  )
}
