import type { MentorApplicationForReview } from '@everguide/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/use-auth'
import { EmptyState } from '@/components/common/empty-state'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { expertiseLabels } from '@/config/mentors'
import { mentorKeys } from '@/hooks/use-mentors'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'

/** Admins review mentor evidence. The server re-checks the admin role on every request. */
export default function MentorApplicationsPage() {
  usePageTitle('Mentor applications')
  const { user } = useAuth()
  const applications = useQuery({
    queryKey: mentorKeys.applications(user?.id),
    queryFn: api.listMentorApplications,
  })

  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Mentor applications</h1>
      <p className="mt-2 text-muted-foreground">
        Verify a mentor only when the evidence supports their profile. A company name on a profile
        is not enough.
      </p>
      <div className="mt-8">
        {applications.isPending ? (
          <PageLoader label="Loading applications…" />
        ) : applications.isError ? (
          <p className="text-danger">{applications.error.message}</p>
        ) : applications.data.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No applications waiting">
            <p>New mentor applications will appear here.</p>
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {applications.data.map((a) => (
              <ApplicationCard key={a.verificationId} application={a} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ApplicationCard({ application: a }: { application: MentorApplicationForReview }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [notes, setNotes] = useState('')
  const decide = useMutation({
    mutationFn: (decision: 'verified' | 'rejected') =>
      api.decideMentorApplication(a.verificationId, { decision, notes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mentorKeys.applications(user?.id) }),
  })
  return (
    <li className="rounded-lg border border-border bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{a.name}</p>
          <p className="text-sm text-muted-foreground">
            {[a.jobTitle, a.company].filter(Boolean).join(' · ')} · {a.yearsExperience} years ·{' '}
            {a.email}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          Applied {formatRelative(a.submittedAt)}
        </span>
      </div>
      <p className="mt-3 font-medium">{a.headline}</p>
      <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{a.bio}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {a.expertise.map((e) => (
          <Badge key={e}>{expertiseLabels[e]}</Badge>
        ))}
      </div>
      <div className="mt-4 rounded-md bg-surface-muted p-4 text-sm">
        <p className="font-medium">Evidence</p>
        <a
          href={a.evidenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 break-all text-primary hover:underline"
        >
          {a.evidenceUrl} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        </a>
        {a.evidenceNotes && <p className="mt-2 text-muted-foreground">{a.evidenceNotes}</p>}
      </div>
      <label htmlFor={`notes-${a.verificationId}`} className="mt-4 block text-sm font-medium">
        Review notes (shared with the applicant if rejected)
      </label>
      <Textarea
        id={`notes-${a.verificationId}`}
        rows={2}
        className="mt-1 min-h-16"
        value={notes}
        maxLength={2000}
        onChange={(e) => setNotes(e.target.value)}
      />
      {decide.error && (
        <FormAlert tone="error" className="mt-3">
          {decide.error.message}
        </FormAlert>
      )}
      <div className="mt-4 flex gap-3">
        <Button onClick={() => decide.mutate('verified')} disabled={decide.isPending}>
          Verify mentor
        </Button>
        <Button
          variant="outline"
          onClick={() => decide.mutate('rejected')}
          disabled={decide.isPending}
        >
          Reject
        </Button>
      </div>
    </li>
  )
}
