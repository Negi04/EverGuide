import { Link, Outlet } from 'react-router'
import { Logo } from '@/components/brand/logo'
import { GuidanceMap } from '@/components/brand/guidance-map'

export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <main id="main" className="flex flex-col px-4 py-8 sm:px-10">
        <Link to="/" aria-label="EverGuide home" className="self-start rounded-md">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <Outlet />
        </div>
      </main>
      <aside className="on-ink relative hidden flex-col justify-center overflow-hidden bg-band p-12 lg:flex">
        <GuidanceMap />
        <p className="mx-auto mt-10 max-w-sm text-center text-lg leading-relaxed text-ink-muted">
          Career, AI guidance, mentors, wellness and money — connected around your goals.
        </p>
      </aside>
    </div>
  )
}
