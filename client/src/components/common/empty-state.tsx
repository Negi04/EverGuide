import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  children: ReactNode
  action?: ReactNode
  className?: string
}

/** Intentional "nothing here yet" state — never filled with fake data. */
export function EmptyState({ icon: Icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface p-6 sm:p-8',
        className,
      )}
    >
      <span className="inline-flex size-10 items-center justify-center rounded-md bg-brand-50 text-brand-700">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <div className="max-w-prose text-sm leading-relaxed text-muted-foreground">{children}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
