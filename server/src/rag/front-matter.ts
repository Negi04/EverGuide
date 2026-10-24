import { guidanceDomains } from '@everguide/shared'
import { z } from 'zod'

export const knowledgeFrontMatterSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,120}$/, 'Use lowercase letters, numbers and hyphens.'),
  title: z.string().min(3).max(200),
  domain: z.enum(guidanceDomains),
  source_name: z.string().min(2).max(200),
  source_url: z
    .string()
    .regex(/^https:\/\//, 'Must start with https://')
    .optional(),
  license: z.string().min(2).max(200),
  status: z.enum(['draft', 'approved', 'archived']).default('draft'),
})

export type KnowledgeFrontMatter = z.infer<typeof knowledgeFrontMatterSchema>

/** Split a Markdown file into its `---` front matter (simple `key: value` lines) and body. */
export function parseKnowledgeFile(raw: string): { meta: KnowledgeFrontMatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw)
  if (!match) throw new Error('Missing front matter block at the top of the file.')
  const [, header = '', body = ''] = match

  const fields: Record<string, string> = {}
  for (const line of header.split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key && value) fields[key] = value
  }

  return { meta: knowledgeFrontMatterSchema.parse(fields), body: body.trim() }
}
