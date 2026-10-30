import type { AdminFeedback } from '@everguide/shared'
import { MessageSquareWarning, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/input'
import { useAdminFeedback } from '@/hooks/use-admin'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatRelative } from '@/lib/format'

export default function FeedbackPage() {
  usePageTitle('AI feedback')
  const [rating, setRating] = useState<AdminFeedback['rating'] | ''>('not_helpful')
  const feedback = useAdminFeedback(rating || undefined)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">AI feedback</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Ratings people gave to AI Guide answers. To protect privacy you see the answer and the
          comment only: not who rated it or what they asked.
        </p>
      </div>
      <NativeSelect
        aria-label="Show"
        className="w-56"
        value={rating}
        onChange={(e) => setRating(e.target.value as AdminFeedback['rating'] | '')}
      >
        <option value="not_helpful">Not helpful</option>
        <option value="helpful">Helpful</option>
        <option value="">All ratings</option>
      </NativeSelect>
      {feedback.isPending ? (
        <PageLoader label="Loading feedback…" />
      ) : feedback.isError ? (
        <p className="text-danger">{feedback.error.message}</p>
      ) : feedback.data.length === 0 ? (
        <EmptyState icon={MessageSquareWarning} title="No feedback here yet">
          <p>Ratings appear when people use the thumbs on AI Guide answers.</p>
        </EmptyState>
      ) : (
        <ul aria-label="Feedback" className="space-y-3">
          {feedback.data.map((f) => (
            <li key={f.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {f.rating === 'helpful' ? (
                  <Badge tone="brand">
                    <ThumbsUp aria-hidden /> Helpful
                  </Badge>
                ) : (
                  <Badge tone="amber">
                    <ThumbsDown aria-hidden /> Not helpful
                  </Badge>
                )}
                {f.grounded === false && <Badge>Answered without sources</Badge>}
                <span className="text-xs text-muted-foreground">{formatRelative(f.createdAt)}</span>
              </div>
              {f.comment && (
                <blockquote className="mt-3 border-l-2 border-brand-300 pl-3 text-sm text-foreground">
                  {f.comment}
                </blockquote>
              )}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">The answer</summary>
                <p className="mt-2 whitespace-pre-wrap text-foreground">{f.answer}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
