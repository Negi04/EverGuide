import { MAX_RESUME_BYTES, MAX_RESUME_PAGES } from '@everguide/shared'
import { extractText, getDocumentProxy } from 'unpdf'
import { AppError } from './errors.ts'

const MAX_TEXT_CHARS = 60_000
const MIN_TEXT_CHARS = 50

const invalid = (message: string) => new AppError(400, 'validation_failed', message)

/**
 * Validate an uploaded PDF and extract its text. The checks run cheapest first:
 * size, then the "%PDF-" signature (a renamed .exe or image fails here), then a real
 * parse (a file that only *starts* like a PDF fails here).
 */
export async function readPdf(data: Buffer): Promise<{ pageCount: number; text: string }> {
  if (data.length === 0) throw invalid('The file is empty.')
  if (data.length > MAX_RESUME_BYTES)
    throw new AppError(413, 'payload_too_large', 'PDFs can be up to 5 MB.')
  if (data.subarray(0, 5).toString('latin1') !== '%PDF-') throw invalid('That file is not a PDF.')

  let pageCount: number
  let text: string
  try {
    const pdf = await getDocumentProxy(new Uint8Array(data))
    const extracted = await extractText(pdf, { mergePages: true })
    pageCount = extracted.totalPages
    text = extracted.text
  } catch {
    throw invalid('We couldn’t read this PDF. It may be damaged or password-protected.')
  }

  if (pageCount > MAX_RESUME_PAGES)
    throw invalid(`Resumes can have up to ${MAX_RESUME_PAGES} pages.`)
  const cleaned = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (cleaned.length < MIN_TEXT_CHARS) {
    throw invalid(
      'We couldn’t find any text in this PDF. Scanned images aren’t supported yet; export your resume as a text-based PDF.',
    )
  }
  return { pageCount, text: cleaned.slice(0, MAX_TEXT_CHARS) }
}

/** A safe display name: no path, no control characters, always ending in .pdf. */
export function safeFileName(raw: string | undefined): string {
  let name = 'resume.pdf'
  if (raw) {
    try {
      name = decodeURIComponent(raw)
    } catch {
      name = raw
    }
  }
  name = name.split(/[\\/]/).pop() ?? ''
  name = name
    // Intentionally matches control characters, to strip them from user-supplied names.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 196)
  if (!name) name = 'resume'
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`
}
