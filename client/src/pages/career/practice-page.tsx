import {
  practiceAttemptSchema,
  type InterviewQuestionDetail,
  type PracticeAttempt,
} from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Lightbulb, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import {
  interviewCategoryLabels,
  interviewDifficultyLabels,
  interviewRoleLabels,
} from '@/config/interview'
import { aiKeys } from '@/hooks/use-ai'
import { interviewKeys, useInterviewQuestion } from '@/hooks/use-interview'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { UsageNote } from '@/pages/guide/workspace-notes'
import { SaveQuestionButton } from './save-question-button'

export default function PracticePage() {
  const { questionId = '' } = useParams()
  const question = useInterviewQuestion(questionId)
  usePageTitle('Interview practice')

  if (question.isPending) return <PageLoader label="Loading question…" />
  if (question.isError) {
    return (
      <div>
        <p className="text-danger">{question.error.message}</p>
        <Link
          to="/app/career/interview"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          Back to questions
        </Link>
      </div>
    )
  }
  return <Practice question={question.data} />
}

function Practice({ question }: { question: InterviewQuestionDetail }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [answer, setAnswer] = useState('')
  const [validation, setValidation] = useState<string | null>(null)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: interviewKeys.all(user?.id) })
    void queryClient.invalidateQueries({ queryKey: aiKeys.usage(user?.id) })
  }

  const submit = useMutation({
    mutationFn: (withFeedback: boolean) =>
      api.createPracticeAttempt(question.id, { answer, withFeedback }),
    onSuccess: () => {
      setAnswer('')
      refresh()
    },
  })

  const send = (withFeedback: boolean) => {
    const checked = practiceAttemptSchema.safeParse({ answer, withFeedback })
    if (!checked.success)
      return setValidation(checked.error.issues[0]?.message ?? 'Check your answer.')
    setValidation(null)
    submit.mutate(withFeedback)
  }

  return (
    <div>
      <Link
        to="/app/career/interview"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> All questions
      </Link>

      <div className="mt-4 flex items-start gap-2">
        <h2 className="flex-1 text-2xl font-semibold text-ink">{question.prompt}</h2>
        <SaveQuestionButton
          questionId={question.id}
          saved={question.saved}
          label={question.prompt}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge>{interviewCategoryLabels[question.category]}</Badge>
        <Badge>{interviewRoleLabels[question.role]}</Badge>
        <Badge>{interviewDifficultyLabels[question.difficulty]}</Badge>
      </div>

      <details className="mt-5 rounded-md border border-border bg-surface p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
          <Lightbulb className="size-4 text-accent-text" aria-hidden /> How to approach it
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{question.guidance}</p>
      </details>

      <div className="mt-6">
        <label htmlFor="practice-answer" className="text-sm font-medium text-ink">
          Your answer
        </label>
        <Textarea
          id="practice-answer"
          rows={8}
          value={answer}
          maxLength={5000}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Write your answer as you would say it in the interview."
          className="mt-2"
          aria-invalid={validation ? true : undefined}
          aria-describedby="answer-help"
        />
        <p id="answer-help" className="mt-1 text-xs text-muted-foreground">
          {answer.length} / 5000 characters
        </p>
        {(validation ?? submit.error?.message) && (
          <FormAlert tone="error" className="mt-3">
            {validation ?? submit.error?.message}
          </FormAlert>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => send(true)} disabled={submit.isPending}>
            <Sparkles aria-hidden />{' '}
            {submit.isPending && submit.variables ? 'Getting feedback…' : 'Get AI feedback'}
          </Button>
          <Button variant="outline" onClick={() => send(false)} disabled={submit.isPending}>
            Save without feedback
          </Button>
          <UsageNote />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          AI feedback is coaching on your answer, not a prediction of how an interview will go. Each
          feedback request uses one AI answer from your monthly allowance.
        </p>
      </div>

      <section aria-labelledby="attempts-title" className="mt-10">
        <h2 id="attempts-title" className="text-lg font-semibold text-ink">
          Your practice answers
        </h2>
        {question.attempts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing yet. Your answers and feedback will appear here.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {question.attempts.map((attempt) => (
              <AttemptCard key={attempt.id} attempt={attempt} onDeleted={refresh} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function AttemptCard({ attempt, onDeleted }: { attempt: PracticeAttempt; onDeleted: () => void }) {
  const remove = useMutation({
    mutationFn: () => api.deletePracticeAttempt(attempt.id),
    onSuccess: onDeleted,
  })
  return (
    <li className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{formatRelative(attempt.createdAt)}</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete this practice answer"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {attempt.answer}
      </p>
      {attempt.feedback && (
        <div className="mt-4 rounded-md border border-blue-100 bg-blue-50/50 p-4 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
            <Sparkles className="size-3.5" aria-hidden /> AI-generated feedback
          </p>
          <p className="mt-2 text-foreground">{attempt.feedback.summary}</p>
          {attempt.feedback.strengths.length > 0 && (
            <>
              <h3 className="mt-3 font-semibold text-ink">What worked</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {attempt.feedback.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {attempt.feedback.improvements.length > 0 && (
            <>
              <h3 className="mt-3 font-semibold text-ink">To improve</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {attempt.feedback.improvements.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {attempt.feedback.suggestedStructure && (
            <>
              <h3 className="mt-3 font-semibold text-ink">A stronger structure</h3>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">
                {attempt.feedback.suggestedStructure}
              </p>
            </>
          )}
        </div>
      )}
    </li>
  )
}
