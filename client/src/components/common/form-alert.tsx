import { CircleAlert, CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Form-level success or error message, announced to screen readers. */
export function FormAlert({
  tone,
  children,
  className,
}: {
  tone: 'error' | 'success'
  children: ReactNode
  className?: string
}) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-md border px-4 py-3 text-sm leading-relaxed',
        tone === 'error'
          ? 'border-danger/30 bg-danger/5 text-danger'
          : 'border-success/30 bg-success/5 text-success',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
