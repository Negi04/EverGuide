import {
  resumeAnalysisRequestSchema,
  type ResumeAlignment,
  type ResumeAnalysis,
} from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Quote, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input, Textarea } from '@/components/ui/input'
import { aiKeys } from '@/hooks/use-ai'
import { usePageTitle } from '@/hooks/use-page-title'
import { resumeKeys, useResume } from '@/hooks/use-resumes'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { UsageNote } from '@/pages/guide/workspace-notes'

const alignmentLabel: Record<ResumeAlignment, { text: string; tone: 'blue' | 'gold' | 'neutral' }> =
  {
    strong: { text: 'Strong match', tone: 'blue' },
    partial: { text: 'Partial match', tone: 'gold' },
    limited: { text: 'Limited match', tone: 'neutral' },
    not_assessed: { text: 'General review (no job description)', tone: 'neutral' },
  }

export default function ResumeDetailPage() {
  const { resumeId = '' } = useParams()
  const resume = useResume(resumeId)
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [targetRole, setTargetRole] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [validation, setValidation] = useState<string | null>(null)
  usePageTitle(resume.data?.fileName ?? 'Resume')

  const analyse = useMutation({
    mutationFn: () => api.analyseResume(resumeId, { targetRole, jobDescription }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: resumeKeys.all(user?.id) })
      void queryClient.invalidateQueries({ queryKey: aiKeys.usage(user?.id) })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const checked = resumeAnalysisRequestSchema.safeParse({ targetRole, jobDescription })
    if (!checked.success)
      return setValidation(checked.error.issues[0]?.message ?? 'Check the form.')
    setValidation(null)
    analyse.mutate()
  }

  if (resume.isPending) return <PageLoader label="Loading resume…" />
  if (resume.isError) {
    return (
      <div>
        <p className="text-danger">{resume.error.message}</p>
        <Link
          to="/app/career/resume"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          Back to resumes
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link
        to="/app/career/resume"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> All resumes
      </Link>
      <h2 className="mt-4 text-2xl font-semibold text-ink">{resume.data.fileName}</h2>

      <form
        onSubmit={submit}
        className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-5"
      >
        <h3 className="font-semibold text-ink">New analysis</h3>
        <FormField label="Target role (optional)">
          <Input
            value={targetRole}
            maxLength={120}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Junior data analyst"
          />
        </FormField>
        <FormField
          label="Job description (optional)"
          hint="Paste a job description to see how well your resume matches it."
        >
          <Textarea
            value={jobDescription}
            maxLength={10_000}
            rows={6}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </FormField>
        {(validation ?? analyse.error?.message) && (
          <FormAlert tone="error">{validation ?? analyse.error?.message}</FormAlert>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={analyse.isPending}>
            <Sparkles aria-hidden />{' '}
            {analyse.isPending ? 'Analysing… (up to a minute)' : 'Analyse resume'}
          </Button>
          <UsageNote />
        </div>
      </form>

      <section aria-labelledby="reports-title" className="mt-10">
        <h3 id="reports-title" className="text-lg font-semibold text-ink">
          Reports
        </h3>
        {resume.data.analyses.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {resume.data.analyses.map((analysis) => (
              <ReportCard key={analysis.id} analysis={analysis} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ReportCard({ analysis }: { analysis: ResumeAnalysis }) {
  const { report } = analysis
  const alignment = alignmentLabel[report.alignment]
  return (
    <article
      aria-label="Resume report"
      className="rounded-lg border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
          <Sparkles className="size-3.5" aria-hidden /> AI-generated report
        </span>
        <Badge tone={alignment.tone}>{alignment.text}</Badge>
        <span className="text-xs text-muted-foreground">
          {analysis.targetRole ? `${analysis.targetRole} · ` : ''}
          {formatRelative(analysis.createdAt)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{report.summary}</p>

      {report.strengths.length > 0 && (
        <>
          <h4 className="mt-5 text-sm font-semibold text-ink">Strengths</h4>
          <ul className="mt-2 space-y-2">
            {report.strengths.map((s) => (
              <li key={s.point} className="text-sm">
                <p>{s.point}</p>
                {s.evidence && (
                  <p className="mt-0.5 flex gap-1.5 text-xs text-muted-foreground">
                    <Quote className="mt-0.5 size-3 shrink-0" aria-hidden /> {s.evidence}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {report.gaps.length > 0 && (
        <>
          <h4 className="mt-5 text-sm font-semibold text-ink">Gaps to address</h4>
          <ul className="mt-2 space-y-2 text-sm">
            {report.gaps.map((g) => (
              <li key={g.requirement}>
                <span className="font-medium">{g.requirement}:</span>{' '}
                <span className="text-muted-foreground">{g.suggestion}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {report.suggestions.length > 0 && (
        <>
          <h4 className="mt-5 text-sm font-semibold text-ink">Suggested changes</h4>
          <ul className="mt-2 space-y-2 text-sm">
            {report.suggestions.map((s) => (
              <li key={`${s.section}-${s.suggestion}`}>
                <Badge>{s.section}</Badge>{' '}
                <span className="text-muted-foreground">{s.suggestion}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {report.missingKeywords.length > 0 && (
        <>
          <h4 className="mt-5 text-sm font-semibold text-ink">
            Keywords from the job description to consider
          </h4>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {report.missingKeywords.map((k) => (
              <li key={k}>
                <Badge tone="gold">{k}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-5 text-xs text-muted-foreground">
        AI can misread layouts or miss context. Only add skills and experience you genuinely have.
      </p>
    </article>
  )
}
