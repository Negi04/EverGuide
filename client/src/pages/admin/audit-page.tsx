import type { AuditQuery } from '@everguide/shared'
import { ScrollText } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/input'
import { useAuditLog } from '@/hooks/use-admin'
import { usePageTitle } from '@/hooks/use-page-title'

const actionLabels: Record<string, string> = {
  'mentor.verified': 'Verified a mentor',
  'mentor.rejected': 'Rejected a mentor application',
  'resource.created': 'Added a resource',
  'resource.updated': 'Edited a resource',
  'resource.published': 'Published a resource',
  'resource.unpublished': 'Unpublished a resource',
  'resource.archived': 'Archived a resource',
  'resource.deleted': 'Deleted a resource',
  'knowledge.uploaded': 'Uploaded a knowledge document',
  'knowledge.approved': 'Approved a knowledge document',
  'knowledge.drafted': 'Moved a knowledge document to draft',
  'knowledge.archived': 'Archived a knowledge document',
  'role.admin_granted': 'Made someone an admin',
  'role.admin_removed': 'Removed someone’s admin role',
  'account.deleted': 'Deleted their account',
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export default function AuditPage() {
  usePageTitle('Audit log')
  const [area, setArea] = useState<AuditQuery['area'] | ''>('')
  const log = useAuditLog(area || undefined)
  const entries = log.data?.pages.flatMap((p) => p.entries) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Audit log</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A permanent record of sensitive actions: who did what, and when. Entries can’t be edited
          from the app.
        </p>
      </div>
      <NativeSelect
        aria-label="Area"
        className="w-56"
        value={area}
        onChange={(e) => setArea(e.target.value as AuditQuery['area'] | '')}
      >
        <option value="">Everything</option>
        <option value="role">Roles</option>
        <option value="mentor">Mentors</option>
        <option value="resource">Resources</option>
        <option value="knowledge">Knowledge base</option>
        <option value="account">Accounts</option>
      </NativeSelect>
      {log.isPending ? (
        <PageLoader label="Loading the audit log…" />
      ) : log.isError ? (
        <p className="text-danger">{log.error.message}</p>
      ) : entries.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nothing recorded yet">
          <p>Admin actions and account deletions will appear here.</p>
        </EmptyState>
      ) : (
        <ol
          aria-label="Audit entries"
          className="divide-y divide-border rounded-lg border border-border bg-surface"
        >
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-3 text-sm"
            >
              <span>
                <span className="font-medium text-ink">{e.actorName ?? 'Deleted account'}</span>{' '}
                {actionLabels[e.action] ?? e.action}
                {typeof e.metadata.slug === 'string' && (
                  <span className="text-muted-foreground"> · {e.metadata.slug}</span>
                )}
              </span>
              <time dateTime={e.createdAt} className="text-xs text-muted-foreground">
                {when(e.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
      {log.hasNextPage && (
        <Button
          variant="outline"
          disabled={log.isFetchingNextPage}
          onClick={() => void log.fetchNextPage()}
        >
          {log.isFetchingNextPage ? 'Loading…' : 'Show older'}
        </Button>
      )}
    </div>
  )
}
