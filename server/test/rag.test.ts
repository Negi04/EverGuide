import { describe, expect, it } from 'vitest'
import { normalize } from '../src/lib/gemini.ts'
import { chunkMarkdown, embeddingText } from '../src/rag/chunker.ts'
import { parseKnowledgeFile } from '../src/rag/front-matter.ts'

const file = `---
slug: test-guide
title: Test guide
domain: career
source_name: EverGuide starter guide (AI-drafted, pending expert review)
license: EverGuide original content
status: approved
---

## First section

Paragraph one.

Paragraph two.

## Second section

Another paragraph.
`

describe('parseKnowledgeFile', () => {
  it('reads front matter and body', () => {
    const { meta, body } = parseKnowledgeFile(file)
    expect(meta).toMatchObject({ slug: 'test-guide', domain: 'career', status: 'approved' })
    expect(body.startsWith('## First section')).toBe(true)
  })

  it('defaults to draft so nothing is published by accident', () => {
    const { meta } = parseKnowledgeFile(file.replace('status: approved\n', ''))
    expect(meta.status).toBe('draft')
  })

  it('rejects an unknown domain and a non-https source URL', () => {
    expect(() => parseKnowledgeFile(file.replace('domain: career', 'domain: astrology'))).toThrow()
    expect(() =>
      parseKnowledgeFile(file.replace('license:', 'source_url: http://x.example\nlicense:')),
    ).toThrow()
  })

  it('requires a front matter block', () => {
    expect(() => parseKnowledgeFile('# Just markdown')).toThrow(/front matter/)
  })
})

describe('chunkMarkdown', () => {
  it('creates one chunk per section, keeping the heading', () => {
    const chunks = chunkMarkdown(parseKnowledgeFile(file).body)
    expect(chunks).toEqual([
      { index: 0, heading: 'First section', content: 'Paragraph one.\n\nParagraph two.' },
      { index: 1, heading: 'Second section', content: 'Another paragraph.' },
    ])
  })

  it('splits long sections and never exceeds the size limit', () => {
    const sentence = 'This sentence is used to build a long paragraph for testing. '
    const markdown = `## Long\n\n${sentence.repeat(40)}\n\n${sentence.repeat(40)}`
    const chunks = chunkMarkdown(markdown, 500)
    expect(chunks.length).toBeGreaterThan(4)
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(500)
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i))
  })

  it('cuts a single oversized sentence as a last resort', () => {
    const chunks = chunkMarkdown(`## Run-on\n\n${'word '.repeat(400)}`, 300)
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(300)
  })

  it('includes the title and heading in the embedded text', () => {
    expect(embeddingText('Guide', { index: 0, heading: 'Intro', content: 'Body' })).toBe(
      'Guide\nIntro\n\nBody',
    )
  })
})

describe('normalize', () => {
  it('scales a vector to unit length', () => {
    const v = normalize([3, 4])
    expect(v[0]).toBeCloseTo(0.6)
    expect(v[1]).toBeCloseTo(0.8)
  })

  it('leaves a zero vector unchanged', () => {
    expect(normalize([0, 0])).toEqual([0, 0])
  })
})
