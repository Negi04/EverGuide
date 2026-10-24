export type Chunk = { index: number; heading: string | null; content: string }

/**
 * Split Markdown into retrieval chunks along its structure: one chunk per section
 * (## heading), with long sections split on paragraph and then sentence boundaries.
 * Sections are self-contained ideas, so overlapping chunks isn't needed here.
 */
export function chunkMarkdown(markdown: string, maxChars = 1500): Chunk[] {
  const sections: { heading: string | null; text: string }[] = []
  let heading: string | null = null
  let lines: string[] = []

  const flush = () => {
    const text = lines.join('\n').trim()
    if (text) sections.push({ heading, text })
    lines = []
  }

  for (const line of markdown.split(/\r?\n/)) {
    const match = /^#{1,3}\s+(.+?)\s*$/.exec(line)
    if (match) {
      flush()
      heading = match[1] ?? null
    } else {
      lines.push(line)
    }
  }
  flush()

  const chunks: Chunk[] = []
  for (const section of sections) {
    for (const content of packPieces(splitParagraphs(section.text, maxChars), maxChars)) {
      chunks.push({ index: chunks.length, heading: section.heading, content })
    }
  }
  return chunks
}

function splitParagraphs(text: string, maxChars: number): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .flatMap((paragraph) =>
      paragraph.length <= maxChars ? [paragraph] : splitSentences(paragraph, maxChars),
    )
}

function splitSentences(paragraph: string, maxChars: number): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [paragraph]
  const pieces = packPieces(
    sentences.map((s) => s.trim()),
    maxChars,
  )
  // A single sentence longer than the limit is cut as a last resort.
  return pieces.flatMap((piece) =>
    piece.length <= maxChars ? [piece] : (piece.match(new RegExp(`.{1,${maxChars}}`, 'g')) ?? []),
  )
}

/** Join consecutive pieces into chunks no longer than maxChars. */
function packPieces(pieces: string[], maxChars: number): string[] {
  const packed: string[] = []
  let current = ''
  for (const piece of pieces) {
    const candidate = current ? `${current}\n\n${piece}` : piece
    if (candidate.length <= maxChars) {
      current = candidate
    } else {
      if (current) packed.push(current)
      current = piece
    }
  }
  if (current) packed.push(current)
  return packed
}

/** Text that gets embedded: title and heading give each chunk its context. */
export function embeddingText(title: string, chunk: Chunk): string {
  return [title, chunk.heading, '', chunk.content].filter((part) => part !== null).join('\n')
}
