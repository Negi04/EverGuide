import { useEffect, type RefObject } from 'react'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Writes how far an element has scrolled into view (0 → 1) to a CSS variable on it.
 * 0 = its top is at the bottom of the screen; 1 = its top has travelled `distance` of
 * the screen height. Styles read the variable, so React never re-renders per frame.
 */
export function useScrollVar(
  ref: RefObject<HTMLElement | null>,
  name = '--scroll',
  distance = 0.6,
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) {
      el.style.setProperty(name, '1')
      return
    }
    let frame = 0
    const update = () => {
      frame = 0
      const { top } = el.getBoundingClientRect()
      const vh = window.innerHeight
      const progress = Math.min(1, Math.max(0, (vh - top) / (vh * distance)))
      el.style.setProperty(name, progress.toFixed(3))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [ref, name, distance])
}
