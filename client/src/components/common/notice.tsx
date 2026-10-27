import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Inline information banner, e.g. to flag features that are not connected yet. */
export function Notice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-md border border-accent-border bg-accent-subtle px-4 py-3 text-sm text-foreground',
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}
