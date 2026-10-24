import { Label } from 'radix-ui'
import type { ReactElement, ReactNode } from 'react'
import { cloneElement, useId } from 'react'
import { cn } from '@/lib/utils'

type FieldControlProps = {
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

type FormFieldProps = {
  label: string
  hint?: ReactNode
  error?: string
  className?: string
  /** A single input-like element; it receives id and ARIA wiring automatically. */
  children: ReactElement<FieldControlProps>
}

/** Label + control + hint + error, with accessible associations wired up. */
export function FormField({ label, hint, error, className, children }: FormFieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label.Root htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label.Root>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
