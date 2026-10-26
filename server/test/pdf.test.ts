import { describe, expect, it } from 'vitest'
import { readPdf, safeFileName } from '../src/lib/pdf.ts'
import { makePdf, sampleResumeLines } from './fixtures/make-pdf.ts'

async function rejection(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error as { status: number; message: string }
  }
  throw new Error('expected readPdf to reject')
}

describe('readPdf', () => {
  it('extracts text and counts pages', async () => {
    const result = await readPdf(makePdf([sampleResumeLines, ['Projects: support dashboard.']]))
    expect(result.pageCount).toBe(2)
    expect(result.text).toContain('Customer Support Specialist')
  })

  it('rejects empty and oversized files', async () => {
    expect((await rejection(readPdf(Buffer.alloc(0)))).message).toMatch(/empty/)
    expect((await rejection(readPdf(Buffer.alloc(5 * 1024 * 1024 + 1, 1)))).status).toBe(413)
  })

  it('rejects files that are not PDFs, even if renamed', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect((await rejection(readPdf(png))).message).toMatch(/not a PDF/)
  })

  it('rejects files that only start like a PDF', async () => {
    const fake = Buffer.from('%PDF-1.4 this is not really a PDF document at all')
    expect((await rejection(readPdf(fake))).message).toMatch(/couldn’t read this PDF/)
  })

  it('rejects documents with too many pages', async () => {
    const pages = Array.from({ length: 21 }, (_, i) => [
      `Page ${i + 1} with some resume text on it.`,
    ])
    expect((await rejection(readPdf(makePdf(pages)))).message).toMatch(/up to 20 pages/)
  })

  it('explains when a PDF has no text (e.g. a scanned image)', async () => {
    expect((await rejection(readPdf(makePdf([[]])))).message).toMatch(/couldn’t find any text/)
  })
})

describe('safeFileName', () => {
  it.each([
    ['My%20Resume.pdf', 'My Resume.pdf'],
    ['../../etc/passwd', 'passwd.pdf'],
    ['C:\\Users\\asha\\cv.PDF', 'cv.PDF'],
    ['bad\u0000name\u0007.pdf', 'badname.pdf'],
    ['%E0%A4%', '%E0%A4%.pdf'],
    [undefined, 'resume.pdf'],
    ['', 'resume.pdf'],
  ])('%s → %s', (input, expected) => {
    expect(safeFileName(input)).toBe(expected)
  })

  it('limits the length', () => {
    expect(safeFileName(`${'a'.repeat(400)}.pdf`).length).toBeLessThanOrEqual(200)
  })
})
