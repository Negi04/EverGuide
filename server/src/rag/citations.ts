// Matches [1], [12] and grouped forms such as [1, 3].
const MARKER = /\s?\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g

/**
 * Keep only citation markers that point at a source we actually retrieved.
 * The model can hallucinate a "[7]" when only five sources exist; such markers are
 * removed, so every citation shown to a user maps to a real retrieved passage.
 */
export function resolveCitations(
  answer: string,
  sourceCount: number,
): { text: string; used: number[] } {
  const used: number[] = []
  const text = answer.replace(MARKER, (match, group: string) => {
    const valid = group
      .split(',')
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= sourceCount)
    if (valid.length === 0) return ''
    for (const n of valid) if (!used.includes(n)) used.push(n)
    const leadingSpace = match.startsWith(' ') ? ' ' : ''
    return leadingSpace + valid.map((n) => `[${n}]`).join('')
  })
  return { text: text.trim(), used }
}
