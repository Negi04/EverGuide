import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Logo } from '@/components/brand/logo'
import { Notice } from '@/components/common/notice'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { appNav } from '@/config/app-nav'
import { cn } from '@/lib/utils'
import { SkipLink } from './skip-link'

function AppNavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {appNav.map(({ label, to, icon: Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === '/app'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground',
                isActive && 'bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700',
              )
            }
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

/** Signed-in application shell. Route protection is added with authentication in Phase 2. */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <SkipLink />
      <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-5">
          <Link to="/" aria-label="EverGuide home" className="rounded-md">
            <Logo />
          </Link>
        </div>
        <nav aria-label="App" className="flex-1 px-3 py-4">
          <AppNavList />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6 lg:hidden">
          <Link to="/" aria-label="EverGuide home" className="rounded-md">
            <Logo />
          </Link>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">App sections</SheetDescription>
              <Logo />
              <nav aria-label="App mobile" className="mt-8">
                <AppNavList onNavigate={() => setMenuOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <Notice className="mb-8">
            Preview of the signed-in workspace. Sign-in and your personal data are connected in the
            next build phase, so everything here is empty for now.
          </Notice>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
