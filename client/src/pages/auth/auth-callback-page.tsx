import { Link, Navigate } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'
import { urlAuthError } from '@/lib/supabase'

/** Landing page for the email confirmation link. */
export default function AuthCallbackPage() {
  usePageTitle('Confirming your email')
  const { status } = useAuth()

  if (!urlAuthError && status === 'loading') return <PageLoader label="Confirming your email…" />
  // Signed in by the link: the guards send new users on to onboarding.
  if (!urlAuthError && status === 'signed-in') return <Navigate to="/app" replace />

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">We couldn’t confirm your email</h1>
      <p className="mt-3 text-muted-foreground">
        {urlAuthError ?? 'This confirmation link is invalid or has already been used.'} If you
        already confirmed, just log in. Otherwise, log in to request a new link.
      </p>
      <Button className="mt-8" asChild>
        <Link to="/login">Go to log in</Link>
      </Button>
    </>
  )
}
