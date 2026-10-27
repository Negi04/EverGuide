import type { Resource } from '@everguide/shared'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/use-auth'
import { Button } from '@/components/ui/button'
import { useSavedResources, useToggleSaved } from '@/hooks/use-resources'

/** Save toggle for signed-in people; a log-in link for visitors. */
export function SaveButton({ resource, size = 'sm' }: { resource: Resource; size?: 'sm' | 'md' }) {
  const { status } = useAuth()
  const saved = useSavedResources()
  const toggle = useToggleSaved()

  if (status !== 'signed-in') {
    return (
      <Button variant="ghost" size={size} asChild>
        <Link to={`/login?redirect=${encodeURIComponent(`/app/resources/${resource.slug}`)}`}>
          <Bookmark className="size-4" aria-hidden /> Log in to save
        </Link>
      </Button>
    )
  }

  const isSaved = saved.data?.some((r) => r.id === resource.id) ?? false
  return (
    <Button
      variant="ghost"
      size={size}
      aria-pressed={isSaved}
      aria-label={isSaved ? `Saved: ${resource.title}` : `Save ${resource.title}`}
      disabled={saved.isPending}
      onClick={() => toggle.mutate({ resource, saved: !isSaved })}
    >
      {isSaved ? (
        <BookmarkCheck className="size-4 text-accent-fg" aria-hidden />
      ) : (
        <Bookmark className="size-4" aria-hidden />
      )}
      {isSaved ? 'Saved' : 'Save'}
    </Button>
  )
}
