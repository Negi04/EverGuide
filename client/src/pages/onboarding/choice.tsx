import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ChoiceProps = ComponentProps<'input'> & {
  type: 'radio' | 'checkbox'
  label: string
  hint?: ReactNode
}

/** A radio button or checkbox styled as a selectable card, keeping native keyboard behaviour. */
export function Choice({ label, hint, className, ...input }: ChoiceProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong has-[:checked]:border-primary has-[:checked]:bg-accent-subtle has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
        className,
      )}
    >
      <input
        className="mt-1 size-4 shrink-0 accent-[var(--primary)] focus-visible:outline-none"
        {...input}
      />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}
