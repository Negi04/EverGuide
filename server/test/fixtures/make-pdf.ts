/**
 * Builds a small, valid PDF containing the given lines of text (one page per array),
 * so tests never need a real person's resume.
 */
export function makePdf(pages: string[][]): Buffer {
  const objects: string[] = []
  const add = (body: string) => objects.push(body) // object number = index + 1

  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('') // pages tree, filled in below once page numbers are known
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  const pageRefs: number[] = []
  for (const lines of pages) {
    const escape = (s: string) =>
      s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    const stream = [
      'BT /F1 11 Tf 50 780 Td 14 TL',
      ...lines.map((line) => `(${escape(line)}) Tj T*`),
      'ET',
    ].join('\n')
    add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
    const contentRef = objects.length
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentRef} 0 R >>`,
    )
    pageRefs.push(objects.length)
  }
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefStart = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

export const sampleResumeLines = [
  'Asha Rao',
  'Customer Support Specialist',
  'Experience: 3 years handling customer issues at an online retailer.',
  'Built weekly Excel reports on ticket volumes and response times.',
  'Skills: Excel, customer communication, basic SQL, problem solving.',
  'Education: B.Com, 2021.',
]
