import { Fragment, type ReactNode } from 'react'

type Props = {
  content: string
  /** Citation numbers that can be opened; other [n] markers render as plain text. */
  citationNumbers?: number[]
  onCite?: (number: number) => void
}

/**
 * Renders the small Markdown subset the AI uses (paragraphs, lists, bold, [n] citations)
 * as React elements. Nothing is injected as HTML, so text that looks like markup —
 * from the model or a document — can never run as code.
 */
export function MessageContent({ content, citationNumbers = [], onCite }: Props) {
  const blocks = content.split(/\n{2,}/).filter((block) => block.trim())

  const inline = (text: string): ReactNode[] =>
    text.split(/(\*\*[^*]+\*\*|\[\d{1,2}\])/g).map((part, i) => {
      const bold = /^\*\*([^*]+)\*\*$/.exec(part)
      if (bold) return <strong key={i}>{bold[1]}</strong>
      const cite = /^\[(\d{1,2})\]$/.exec(part)
      if (cite) {
        const n = Number(cite[1])
        return onCite && citationNumbers.includes(n) ? (
          <button
            key={i}
            type="button"
            onClick={() => onCite(n)}
            className="mx-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-sm bg-brand-100 px-1 align-[0.15em] text-[0.68rem] font-semibold text-brand-700 hover:bg-brand-600 hover:text-white"
            aria-label={`Source ${n}`}
          >
            {n}
          </button>
        ) : (
          <sup key={i} className="text-[0.68rem] text-muted-foreground">
            [{n}]
          </sup>
        )
      }
      return <Fragment key={i}>{part}</Fragment>
    })

  return (
    <div className="space-y-3 text-[0.95rem] leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((line) => line.trim())
        if (lines.every((line) => /^\s*[-*•]\s+/.test(line))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((line, j) => (
                <li key={j}>{inline(line.replace(/^\s*[-*•]\s+/, ''))}</li>
              ))}
            </ul>
          )
        }
        if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {lines.map((line, j) => (
                <li key={j}>{inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>
              ))}
            </ol>
          )
        }
        const heading = /^#{1,4}\s+(.+)$/.exec(lines[0] ?? '')
        if (heading && lines.length === 1) {
          return (
            <p key={i} className="font-semibold text-ink">
              {inline(heading[1] ?? '')}
            </p>
          )
        }
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
