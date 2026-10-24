import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/use-me'
import { safeRedirect } from '@/lib/safe-redirect'
import { useAuth } from './use-auth'

/** Only signed-in users get past this point; others go to login and come back afterwards. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageLoader />
  if (status === 'signed-out') {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return <Outlet />
}

/** Sends users who have not finished onboarding to the onboarding flow first. */
export function RequireOnboarding() {
  const me = useMe()
  const { signOut } = useAuth()

  if (me.isPending) return <PageLoader label="Loading your account…" />
  if (me.isError) {
    return (
      <div
        role="alert"
        className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 px-4"
      >
        <h1 className="text-2xl font-semibold text-ink">We couldn’t load your account</h1>
        <p className="text-muted-foreground">{me.error.message}</p>
        <div className="flex gap-3">
          <Button onClick={() => me.refetch()}>Try again</Button>
          <Button variant="outline" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    )
  }
  if (!me.data.onboardingCompletedAt) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

/**
 * Login and registration pages are pointless when already signed in. This is also what
 * moves people on after they log in, to the page they originally asked for.
 */
export function RedirectIfSignedIn() {
  const { status } = useAuth()
  const [searchParams] = useSearchParams()
  if (status === 'loading') return <PageLoader />
  if (status === 'signed-in')
    return <Navigate to={safeRedirect(searchParams.get('redirect'))} replace />
  return <Outlet />
}
