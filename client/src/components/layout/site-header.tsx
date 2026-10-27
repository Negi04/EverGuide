import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { primaryNav } from '@/config/site'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { status } = useAuth()
  const signedIn = status === 'signed-in'
  const { pathname } = useLocation()
  const [onDark, setOnDark] = useState(false)

  // Over a dark hero (marked data-dark-hero) the header turns dark glass, like the hero.
  useEffect(() => {
    const hero = document.querySelector('[data-dark-hero]')
    // Older browsers (and test environments) lack IntersectionObserver: keep the light header.
    if (!hero || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setOnDark(Boolean(entry?.isIntersecting)),
      { rootMargin: '-64px 0px 0px 0px' },
    )
    observer.observe(hero)
    return () => {
      observer.disconnect()
      setOnDark(false)
    }
  }, [pathname])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b backdrop-blur-xl backdrop-saturate-150 transition-colors duration-300',
        onDark ? 'border-white/10 bg-ink/75' : 'border-border/80 bg-background/80',
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link to="/" aria-label="EverGuide home" className="rounded-md">
          <Logo tone={onDark ? 'ink' : 'default'} />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {primaryNav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      onDark
                        ? 'text-ink-muted hover:text-white'
                        : 'text-muted-foreground hover:text-foreground',
                      isActive && (onDark ? 'text-white' : 'text-foreground'),
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {signedIn ? (
            <Button asChild>
              <Link to="/app">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant={onDark ? 'ghost-ink' : 'ghost'} asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Start your journey</Link>
              </Button>
            </>
          )}
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant={onDark ? 'ghost-ink' : 'ghost'}
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Site navigation</SheetDescription>
            <Logo />
            <nav aria-label="Mobile" className="mt-8">
              <ul className="space-y-1">
                {primaryNav.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-md px-3 py-2.5 text-base font-medium text-foreground hover:bg-surface-muted',
                          isActive && 'bg-surface-muted',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-auto grid gap-2">
              {signedIn ? (
                <Button asChild>
                  <Link to="/app" onClick={() => setMenuOpen(false)}>
                    Open dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link to="/login" onClick={() => setMenuOpen(false)}>
                      Log in
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link to="/register" onClick={() => setMenuOpen(false)}>
                      Start your journey
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
