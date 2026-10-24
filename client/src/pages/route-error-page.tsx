import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import NotFoundPage from './not-found-page'

/** Router-level error boundary: catches render and lazy-loading errors in any route. */
export default function RouteErrorPage() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />
  }

  if (import.meta.env.DEV) {
    console.error(error)
  }

  return (
    <main className="container-page flex min-h-dvh flex-col items-start justify-center py-20">
      <Logo />
      <h1 className="mt-10 text-3xl font-semibold text-ink sm:text-4xl">Something went wrong.</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        An unexpected error stopped this page from loading. Reloading usually fixes it. If it keeps
        happening, please let us know.
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={() => window.location.reload()}>Reload page</Button>
        <Button variant="outline" asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </main>
  )
}
