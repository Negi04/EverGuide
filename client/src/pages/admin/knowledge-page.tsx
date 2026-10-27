import type { KnowledgeDocumentSummary, KnowledgeStatus } from '@everguide/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookCheck, FileUp, LibraryBig } from 'lucide-react'
import { useRef } from 'react'
import { useAuth } from '@/auth/use-auth'
import { EmptyState } from '@/components/common/empty-state'
import { FormAlert } from '@/components/common/form-alert'
import { PageLoader } from '@/components/common/page-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { domainLabels } from '@/config/onboarding'
import { adminKeys, useAdminDocuments } from '@/hooks/use-admin'
import { usePageTitle } from '@/hooks/use-page-title'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'

const statusTone: Record<KnowledgeStatus, 'blue' | 'gold' | 'neutral'> = {
  approved: 'blue',
  draft: 'gold',
  archived: 'neutral',
}
const statusLabel: Record<KnowledgeStatus, string> = {
  approved: 'Approved',
  draft: 'Draft',
  archived: 'Archived',
}

const EXAMPLE = `---
slug: managing-exam-stress
title: Managing exam stress
domain: mental_wellness
source_name: Your organisation or author
license: How it may be used
---

## First section heading

Text of the guide…`

export default function KnowledgePage() {
  usePageTitle('Knowledge base')
  const documents = useAdminDocuments()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const upload = useMutation({
    mutationFn: async (file: File) => api.adminUploadDocument(await file.text()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.documents(user?.id) }),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-ink">Knowledge base</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The AI Guide answers only from <strong>approved</strong> documents. Uploads always start
            as drafts, including new versions of an existing document, so changed content is
            reviewed before answers use it.
          </p>
        </div>
        {/* relative: keeps the visually hidden file input inside this box. */}
        <div className="relative">
          <Button disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
            <FileUp className="size-4" aria-hidden />
            {upload.isPending ? 'Processing…' : 'Upload Markdown'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".md,text/markdown"
            aria-label="Knowledge document file"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload.mutate(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {upload.error && <FormAlert tone="error">{upload.error.message}</FormAlert>}
      {upload.data && (
        <FormAlert tone="success">
          “{upload.data.title}” is stored as a draft ({upload.data.chunks} sections). Approve it
          when it has been reviewed.
        </FormAlert>
      )}

      <details className="rounded-lg border border-border bg-surface p-4 text-sm">
        <summary className="cursor-pointer font-medium text-ink">File format</summary>
        <p className="mt-2 text-muted-foreground">
          A Markdown file with this block at the top. Sections under <code>##</code> headings become
          the passages the AI can cite.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-surface-muted p-3 text-xs">
          {EXAMPLE}
        </pre>
      </details>

      {documents.isPending ? (
        <PageLoader label="Loading documents…" />
      ) : documents.isError ? (
        <p className="text-danger">{documents.error.message}</p>
      ) : documents.data.length === 0 ? (
        <EmptyState icon={LibraryBig} title="No documents yet">
          <p>Upload a Markdown guide to get started.</p>
        </EmptyState>
      ) : (
        <ul aria-label="Knowledge documents" className="space-y-3">
          {documents.data.map((doc) => (
            <li key={doc.id}>
              <DocumentRow doc={doc} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DocumentRow({ doc }: { doc: KnowledgeDocumentSummary }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const change = useMutation({
    mutationFn: (status: KnowledgeStatus) => api.adminSetDocumentStatus(doc.id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.documents(user?.id) }),
  })
  const actions: { status: KnowledgeStatus; label: string }[] = (
    [
      { status: 'approved', label: 'Approve' },
      { status: 'draft', label: 'Move to draft' },
      { status: 'archived', label: 'Archive' },
    ] as const
  ).filter((a) => a.status !== doc.status)

  return (
    <article
      aria-labelledby={`doc-${doc.id}`}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`doc-${doc.id}`} className="font-semibold text-ink">
            {doc.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {domainLabels[doc.domain]} · {doc.chunks} sections · {doc.sourceName} · updated{' '}
            {formatRelative(doc.updatedAt)}
          </p>
        </div>
        <Badge tone={statusTone[doc.status]}>
          {doc.status === 'approved' && <BookCheck aria-hidden />}
          {statusLabel[doc.status]}
        </Badge>
      </div>
      {change.error && <FormAlert tone="error">{change.error.message}</FormAlert>}
      <div className="mt-3 flex flex-wrap gap-1">
        {actions.map((a) => (
          <Button
            key={a.status}
            variant={a.status === 'approved' ? 'primary' : 'ghost'}
            size="sm"
            disabled={change.isPending}
            onClick={() => change.mutate(a.status)}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </article>
  )
}
