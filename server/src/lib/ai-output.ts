/**
 * Helpers for fitting model output to our limits before validation. Gemini enforces
 * `maxItems` but ignores `maxLength`, so a detailed answer can run long. Over-long text is
 * shortened and extra items dropped; anything of the wrong type is passed through
 * unchanged so validation still rejects it.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Shorten text to at most `max` characters, cutting at a word boundary and adding "…". */
export function clampText(value: unknown, max: number): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  // Only back up to a space if that keeps most of the text.
  const end = lastSpace > max * 0.6 ? lastSpace : cut.length
  return `${cut.slice(0, end).replace(/[\s,;:.–-]+$/, '')}…`
}

/** Keep the first `max` items, fitting each one with `fit`. */
export function clampList(value: unknown, max: number, fit: (item: unknown) => unknown): unknown {
  return Array.isArray(value) ? value.slice(0, max).map(fit) : value
}
