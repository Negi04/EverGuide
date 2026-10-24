import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SectionHeadingProps = {
  eyebrow: string
  title: string
  lead?: ReactNode
  id?: string
  className?: string
  tone?: 'default' | 'ink'
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  id,
  className,
  tone = 'default',
}: SectionHeadingProps) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2
        id={id}
        className={cn(
          'mt-3 text-3xl font-semibold sm:text-4xl',
          tone === 'ink' ? 'text-white' : 'text-ink',
        )}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={cn(
            'mt-4 text-lg leading-relaxed',
            tone === 'ink' ? 'text-ink-muted' : 'text-muted-foreground',
          )}
        >
          {lead}
        </p>
      )}
    </div>
  )
}
