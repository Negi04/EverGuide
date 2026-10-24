import { Outlet, ScrollRestoration } from 'react-router'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { SkipLink } from './skip-link'

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <SiteHeader />
      <main id="main" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
      <ScrollRestoration />
    </div>
  )
}
