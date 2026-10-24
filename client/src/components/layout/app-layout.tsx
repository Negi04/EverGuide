import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuth } from '@/auth/use-auth'
import { appNav } from '@/config/app-nav'
import { useMe } from '@/hooks/use-me'
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

function UserPanel() {
  const { data: me } = useMe()
  const { signOut } = useAuth()
  return (
    <div className="border-t border-border p-3">
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium text-foreground">{me?.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{me?.email}</p>
      </div>
      <Button
        variant="ghost"
        className="w-full justify-start gap-3 px-3 text-muted-foreground"
        onClick={() => signOut()}
      >
        <LogOut aria-hidden />
        Sign out
      </Button>
    </div>
  )
}

/** Signed-in application shell. Only rendered behind RequireAuth and RequireOnboarding. */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <SkipLink />
      <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex h-16 items-center px-5">
          <Link to="/" aria-label="EverGuide home" className="rounded-md">
            <Logo />
          </Link>
        </div>
        <nav aria-label="App" className="flex-1 px-3 py-4">
          <AppNavList />
        </nav>
        <UserPanel />
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
              <nav aria-label="App mobile" className="mt-8 flex-1">
                <AppNavList onNavigate={() => setMenuOpen(false)} />
              </nav>
              <UserPanel />
            </SheetContent>
          </Sheet>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
