import { useRef, type ReactNode, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

const canTilt = () =>
  window.matchMedia('(pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A card that leans towards the pointer in 3D, with a soft highlight where the pointer
 * is. Mouse only: touch screens and reduced-motion settings get a flat card.
 */
export function Tilt({
  children,
  className,
  max = 8,
}: {
  children: ReactNode
  className?: string
  max?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || !canTilt()) return
    const r = el.getBoundingClientRect()
    const x = (event.clientX - r.left) / r.width
    const y = (event.clientY - r.top) / r.height
    el.style.setProperty('--rx', `${(0.5 - y) * max}deg`)
    el.style.setProperty('--ry', `${(x - 0.5) * max}deg`)
    el.style.setProperty('--gx', `${x * 100}%`)
    el.style.setProperty('--gy', `${y * 100}%`)
  }
  const leave = () => {
    const el = ref.current
    el?.style.setProperty('--rx', '0deg')
    el?.style.setProperty('--ry', '0deg')
  }

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={cn('tilt', className)}>
      {children}
    </div>
  )
}
