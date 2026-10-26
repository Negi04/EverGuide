import type { AppRole } from '@everguide/shared'
import { ShieldAlert } from 'lucide-react'
import { Outlet } from 'react-router'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import { useMe } from '@/hooks/use-me'

/**
 * Hides pages from users without a role. This is only for a sensible UI: every admin API
 * call is checked against the database on the server, whatever the browser shows.
 */
export function RequireRole({ role }: { role: AppRole }) {
  const me = useMe()
  if (me.isPending) return <PageLoader />
  if (!me.data?.roles.includes(role)) {
    return (
      <EmptyState icon={ShieldAlert} title="You don’t have access to this page">
        <p>This area is for EverGuide administrators.</p>
      </EmptyState>
    )
  }
  return <Outlet />
}
