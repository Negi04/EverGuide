import { cn } from '@/lib/utils'

/**
 * TEMPORARY placeholder mark: a rising path that ends in a guiding star.
 * Replace this component's SVG with the approved EverGuide logo when it is available.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="#0B1530" />
      <path
        d="M7 24.5c4.5-.5 7.5-3 9.5-6.5s4-6 8-7"
        fill="none"
        stroke="#38BDF8"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <circle cx="7" cy="24.5" r="1.75" fill="#F7F9FC" />
      <path d="M24.5 6.5l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1z" fill="#F4B860" />
    </svg>
  )
}

export function Logo({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'ink' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span
        className={cn(
          'font-display text-[1.2rem] font-semibold tracking-tight',
          tone === 'ink' ? 'text-white' : 'text-ink',
        )}
      >
        Ever<span className={tone === 'ink' ? 'text-gold-400' : 'text-blue-700'}>Guide</span>
      </span>
    </span>
  )
}
