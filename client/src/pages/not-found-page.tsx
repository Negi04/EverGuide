import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'

export default function NotFoundPage() {
  usePageTitle('Page not found')

  return (
    <section className="container-page flex min-h-[60vh] flex-col items-start justify-center py-20">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-4xl font-semibold text-ink sm:text-5xl">
        This page took a different path.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        The page you were looking for doesn’t exist or has moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/contact">Contact us</Link>
        </Button>
      </div>
    </section>
  )
}
