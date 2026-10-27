import { paiseToInput, parseRupees } from '@everguide/shared'
import { useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type MoneyInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  /** Amount in paise. */
  value: number
  /** Called with paise once the text is a valid amount. */
  onValueChange?: (paise: number) => void
  /** Called on blur (or Enter) with the final amount, if it changed and is valid. */
  onCommit?: (paise: number) => void
}

/**
 * A rupee amount field. People type rupees ("1,50,000" or "2500.50"); the component works
 * in integer paise and never converts through floating-point arithmetic.
 */
export function MoneyInput({
  value,
  onValueChange,
  onCommit,
  className,
  ...props
}: MoneyInputProps) {
  const [text, setText] = useState(value === 0 ? '' : paiseToInput(value))
  const [lastValue, setLastValue] = useState(value)
  // Follow changes from outside (e.g. after saving), without overwriting typing.
  if (value !== lastValue) {
    setLastValue(value)
    setText(value === 0 ? '' : paiseToInput(value))
  }
  const parsed = text.trim() === '' ? 0 : parseRupees(text)
  const invalid = parsed === null

  const commit = () => {
    if (parsed !== null && parsed !== value) onCommit?.(parsed)
  }

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
        aria-hidden
      >
        ₹
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        aria-invalid={invalid || props['aria-invalid']}
        className={cn('pl-7 tabular-nums', invalid && 'border-danger', className)}
        onChange={(e) => {
          setText(e.target.value)
          const next = e.target.value.trim() === '' ? 0 : parseRupees(e.target.value)
          if (next !== null) onValueChange?.(next)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onCommit) {
            e.preventDefault()
            commit()
          }
        }}
      />
    </div>
  )
}
