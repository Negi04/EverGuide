import type { ResumeSummary } from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, FileText, Lock, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { usePageTitle } from '@/hooks/use-page-title'
import { checkResumeFile, formatBytes, resumeKeys, useResumes } from '@/hooks/use-resumes'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'

export default function ResumePage() {
  usePageTitle('Resume analysis')
  const resumes = useResumes()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const upload = useMutation({
    mutationFn: api.uploadResume,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: resumeKeys.all(user?.id) }),
  })

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow choosing the same file again
    if (!file) return
    const problem = checkResumeFile(file)
    setFileError(problem)
    if (!problem) upload.mutate(file)
  }

  return (
    <div>
      <div className="flex gap-3 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
        <p>
          Your resume is stored privately and only you can access it. When you ask for an analysis,
          its text is sent to Google’s Gemini AI to produce the report. You can delete a resume and
          its reports at any time.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-start gap-3 rounded-lg border-2 border-dashed border-border-strong bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-ink">Upload a resume</p>
          <p className="text-sm text-muted-foreground">Text-based PDF, up to 5 MB and 20 pages.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onFile}
          className="sr-only"
          id="resume-file"
          aria-label="Choose a PDF resume"
        />
        <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          <Upload aria-hidden /> {upload.isPending ? 'Uploading…' : 'Choose PDF'}
        </Button>
      </div>
      {(fileError ?? upload.error?.message) && (
        <FormAlert tone="error" className="mt-3">
          {fileError ?? upload.error?.message}
        </FormAlert>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-ink">Your resumes</h2>
        {resumes.isPending ? (
          <PageLoader label="Loading resumes…" />
        ) : resumes.isError ? (
          <p className="mt-2 text-danger">{resumes.error.message}</p>
        ) : resumes.data.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No resumes yet. Upload one to get started.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
            {resumes.data.map((resume) => (
              <ResumeRow key={resume.id} resume={resume} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ResumeRow({ resume }: { resume: ResumeSummary }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const remove = useMutation({
    mutationFn: () => api.deleteResume(resume.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: resumeKeys.all(user?.id) }),
  })
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <FileText className="size-5 shrink-0 text-blue-600" aria-hidden />
      <Link to={`/app/career/resume/${resume.id}`} className="group min-w-0 flex-1">
        <span className="block truncate text-sm font-medium group-hover:text-primary">
          {resume.fileName}
        </span>
        <span className="text-xs text-muted-foreground">
          {resume.pageCount} {resume.pageCount === 1 ? 'page' : 'pages'} ·{' '}
          {formatBytes(resume.sizeBytes)} · uploaded {formatRelative(resume.createdAt)} ·{' '}
          {resume.analysisCount} {resume.analysisCount === 1 ? 'report' : 'reports'}
        </span>
      </Link>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Delete ${resume.fileName}`}>
            <Trash2 aria-hidden />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Delete this resume?</DialogTitle>
          <DialogDescription>
            The file and all of its reports will be permanently deleted.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-3">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              className="bg-danger hover:bg-danger/90"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete resume
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </li>
  )
}
