import { LoaderCircle } from 'lucide-react'

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-muted-foreground"
    >
      <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
      {label}
    </div>
  )
}
