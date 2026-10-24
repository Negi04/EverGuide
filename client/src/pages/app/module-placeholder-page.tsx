import { Construction } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { appNav } from '@/config/app-nav'
import { usePageTitle } from '@/hooks/use-page-title'

/** Honest placeholder for workspace modules that ship in later build phases. */
export default function ModulePlaceholderPage() {
  const { pathname } = useLocation()
  const item = appNav.find((entry) => entry.to === pathname)
  usePageTitle(item?.label ?? 'Coming soon')

  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow">{item?.label ?? 'Workspace'}</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">{item?.label ?? 'This area'} is on the way</h1>
      <EmptyState
        icon={Construction}
        title="Not built yet"
        className="mt-8"
        action={
          <Button variant="outline" asChild>
            <Link to="/app">Back to dashboard</Link>
          </Button>
        }
      >
        <p>
          {item?.description} This module is scheduled for build phase {item?.phase ?? 'TBD'}.
        </p>
      </EmptyState>
    </div>
  )
}
