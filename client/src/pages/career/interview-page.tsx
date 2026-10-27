import {
  interviewCategories,
  interviewRoles,
  type InterviewCategory,
  type InterviewRole,
} from '@everguide/shared'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/input'
import {
  interviewCategoryLabels,
  interviewDifficultyLabels,
  interviewRoleLabels,
} from '@/config/interview'
import { useInterviewQuestions } from '@/hooks/use-interview'
import { usePageTitle } from '@/hooks/use-page-title'
import { SaveQuestionButton } from './save-question-button'

export default function InterviewPage() {
  usePageTitle('Interview practice')
  const [role, setRole] = useState<InterviewRole | ''>('')
  const [category, setCategory] = useState<InterviewCategory | ''>('')
  const [savedOnly, setSavedOnly] = useState(false)
  const questions = useInterviewQuestions({
    role: role || undefined,
    category: category || undefined,
    saved: savedOnly,
  })

  return (
    <div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Common interview question types with guidance on what a strong answer covers. Write your
        answer, then ask for optional AI feedback. These are general practice questions, not
        questions from any specific employer.
      </p>

      {questions.data && (
        <div className="mt-6 max-w-sm">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-ink">Your progress</span>
            <span className="text-muted-foreground">
              {questions.data.progress.practised} of {questions.data.progress.total} practised
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-label="Questions practised"
            aria-valuemin={0}
            aria-valuemax={questions.data.progress.total}
            aria-valuenow={questions.data.progress.practised}
          >
            <div
              className="h-full bg-fill"
              style={{
                width: `${(questions.data.progress.practised / Math.max(questions.data.progress.total, 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="text-sm">
          <label htmlFor="filter-role" className="mb-1 block font-medium">
            Role
          </label>
          <NativeSelect
            id="filter-role"
            value={role}
            onChange={(e) => setRole(e.target.value as InterviewRole | '')}
            className="w-48"
          >
            <option value="">All roles</option>
            {interviewRoles.map((r) => (
              <option key={r} value={r}>
                {interviewRoleLabels[r]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="text-sm">
          <label htmlFor="filter-type" className="mb-1 block font-medium">
            Type
          </label>
          <NativeSelect
            id="filter-type"
            value={category}
            onChange={(e) => setCategory(e.target.value as InterviewCategory | '')}
            className="w-44"
          >
            <option value="">All types</option>
            {interviewCategories.map((c) => (
              <option key={c} value={c}>
                {interviewCategoryLabels[c]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={savedOnly}
            onChange={(e) => setSavedOnly(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Saved only
        </label>
      </div>

      <div className="mt-6">
        {questions.isPending ? (
          <PageLoader label="Loading questions…" />
        ) : questions.isError ? (
          <p className="text-danger">{questions.error.message}</p>
        ) : questions.data.questions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong p-6 text-sm text-muted-foreground">
            {savedOnly
              ? 'You haven’t saved any questions that match these filters.'
              : 'No questions match these filters.'}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {questions.data.questions.map((q) => (
              <li key={q.id} className="flex items-center gap-2 px-3 py-3 sm:px-4">
                <SaveQuestionButton questionId={q.id} saved={q.saved} label={q.prompt} />
                <Link
                  to={`/app/career/interview/${q.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground group-hover:text-primary">
                      {q.prompt}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <Badge>{interviewCategoryLabels[q.category]}</Badge>
                      <Badge>{interviewRoleLabels[q.role]}</Badge>
                      <Badge>{interviewDifficultyLabels[q.difficulty]}</Badge>
                    </span>
                  </span>
                  {q.attemptCount > 0 && (
                    <span className="flex items-center gap-1 text-xs whitespace-nowrap text-success">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Practised {q.attemptCount}×
                    </span>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
