/**
 * Runs in the page: every piece of visible text measured against the background it
 * actually sits on (layers blended), WCAG AA: 4.5:1, or 3:1 for large text. Text
 * over gradients or images is skipped (its background can't be known exactly).
 */
export function findLowContrastText(): string[] {
  type Rgba = { r: number; g: number; b: number; a: number }
  const parse = (c: string): Rgba | null => {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const [r = 0, g = 0, b = 0, a = 1] = m[1]!
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number)
    return { r, g, b, a }
  }
  const lum = ({ r, g, b }: Rgba) => {
    const f = (v: number) => {
      v /= 255
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const over = (top: Rgba, bottom: Rgba): Rgba => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  })
  const backgroundOf = (el: Element): Rgba | null => {
    const layers: Rgba[] = []
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.backgroundImage !== 'none') return null
      const bg = parse(s.backgroundColor)
      if (bg && bg.a > 0) {
        layers.push(bg)
        if (bg.a >= 1) break
      }
    }
    let color: Rgba = { r: 255, g: 255, b: 255, a: 1 }
    for (const layer of layers.reverse()) color = over(layer, color)
    return color
  }

  const failures: string[] = []
  for (const el of document.querySelectorAll('body *')) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim() ?? '')
      .join(' ')
      .trim()
    if (!text || (el.closest('[aria-hidden="true"]') && !el.closest('figure'))) continue
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 1) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0 || el.closest('.sr-only')) continue
    let fg = parse(s.color)
    if (!fg || fg.a === 0) continue
    const bg = backgroundOf(el)
    if (!bg) continue
    if (fg.a < 1) fg = over(fg, bg)
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a) as [number, number]
    const ratio = (hi + 0.05) / (lo + 0.05)
    const size = parseFloat(s.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700)
    if (ratio < (large ? 3 : 4.5)) {
      failures.push(`${ratio.toFixed(2)}:1 "${text.slice(0, 50)}" (${s.color})`)
    }
  }
  return [...new Set(failures)]
}
