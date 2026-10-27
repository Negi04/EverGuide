import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * TEMPORARY placeholder mark: a rising path that ends in a guiding star.
 * Replace this component's SVG with the approved EverGuide logo when it is available.
 */
export function LogoMark({ className }: { className?: string }) {
  // Unique per logo: the header and footer both show one, and SVG ids must not repeat.
  const gradient = `eg-mark-${useId()}`
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradient})`} />
      <path
        d="M7 24.5c4.5-.5 7.5-3 9.5-6.5s4-6 8-7"
        fill="none"
        stroke="#F8FAFC"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <circle cx="7" cy="24.5" r="1.75" fill="#F8FAFC" />
      <path d="M24.5 6.5l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1z" fill="#F8FAFC" />
    </svg>
  )
}

export function Logo({
  className,
  tone = 'default',
}: {
  className?: string
  tone?: 'default' | 'ink'
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span
        className={cn(
          'font-display text-[1.2rem] font-semibold tracking-tight',
          tone === 'ink' ? 'text-white' : 'text-ink',
        )}
      >
        Ever<span className={tone === 'ink' ? 'text-brand-300' : 'text-accent-fg'}>Guide</span>
      </span>
    </span>
  )
}
