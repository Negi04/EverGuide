import { useEffect } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'

/**
 * Shown after an account is deleted. Signing out happens here, once the user has left the
 * protected area, so the auth guards don't bounce them to the login page.
 */
export default function AccountDeletedPage() {
  usePageTitle('Account deleted')
  const { state } = useLocation()
  const { signOut } = useAuth()
  // Only a real deletion (which sets this navigation state) signs the user out,
  // so a link to this URL cannot be used to log someone out.
  const fromDeletion = (state as { accountDeleted?: boolean } | null)?.accountDeleted === true

  useEffect(() => {
    if (fromDeletion) void signOut('local')
  }, [fromDeletion, signOut])

  if (!fromDeletion) return <Navigate to="/" replace />

  return (
    <section className="container-page flex min-h-[60vh] flex-col items-start justify-center py-20">
      <p className="eyebrow">Account deleted</p>
      <h1 className="mt-3 text-4xl font-semibold text-ink">Your account has been deleted.</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Your profile and everything linked to it have been removed. Thank you for trying EverGuide —
        you’re welcome back any time.
      </p>
      <Button className="mt-8" asChild>
        <Link to="/">Back to the home page</Link>
      </Button>
    </section>
  )
}
