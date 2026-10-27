import { createHash } from 'node:crypto'
import type { Embedder } from '../lib/gemini.ts'
import type { Db } from '../lib/supabase.ts'
import { chunkMarkdown, embeddingText } from './chunker.ts'
import { parseKnowledgeFile, type KnowledgeFrontMatter } from './front-matter.ts'

export type IngestResult = {
  id: string
  slug: string
  title: string
  chunks: number
  /** True when the document and embedding model were unchanged, so nothing was redone. */
  unchanged: boolean
}

/**
 * Store one Markdown knowledge document: validate front matter → chunk → embed → save.
 * Used by `npm run kb:ingest` and by admins uploading from the browser.
 * `override` replaces front-matter fields (uploads are always stored as drafts).
 */
export async function ingestDocument(
  admin: Db,
  embedder: Embedder,
  embeddingModel: string,
  raw: string,
  override: Partial<KnowledgeFrontMatter> = {},
): Promise<IngestResult> {
  const parsed = parseKnowledgeFile(raw)
  const meta = { ...parsed.meta, ...override }

  // The checksum covers the text, the overrides and the embedding model: switching
  // models re-embeds, and an unchanged document is skipped.
  const checksum = createHash('sha256')
    .update(embeddingModel)
    .update(JSON.stringify(override))
    .update(raw)
    .digest('hex')
  const existing = await admin
    .from('knowledge_documents')
    .select('id, checksum')
    .eq('slug', meta.slug)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data?.checksum === checksum) {
    return { id: existing.data.id, slug: meta.slug, title: meta.title, chunks: 0, unchanged: true }
  }

  const chunks = chunkMarkdown(parsed.body)
  if (chunks.length === 0) throw new Error('The document has no text after the front matter.')
  const vectors = await embedder.embed(
    chunks.map((chunk) => embeddingText(meta.title, chunk)),
    'document',
  )

  // Marked pending until its chunks are stored, so an interrupted run is retried
  // instead of leaving a document with missing chunks.
  const document = await admin
    .from('knowledge_documents')
    .upsert(
      {
        slug: meta.slug,
        title: meta.title,
        domain: meta.domain,
        source_name: meta.source_name,
        source_url: meta.source_url ?? null,
        license: meta.license,
        status: meta.status,
        checksum: `pending:${checksum}`,
      },
      { onConflict: 'slug' },
    )
    .select('id')
    .single()
  if (document.error) throw document.error

  const removed = await admin.from('knowledge_chunks').delete().eq('document_id', document.data.id)
  if (removed.error) throw removed.error
  const inserted = await admin.from('knowledge_chunks').insert(
    chunks.map((chunk, i) => ({
      document_id: document.data.id,
      chunk_index: chunk.index,
      heading: chunk.heading,
      content: chunk.content,
      embedding: vectors[i] ?? [],
    })),
  )
  if (inserted.error) throw inserted.error

  const done = await admin
    .from('knowledge_documents')
    .update({ checksum })
    .eq('id', document.data.id)
  if (done.error) throw done.error

  return {
    id: document.data.id,
    slug: meta.slug,
    title: meta.title,
    chunks: chunks.length,
    unchanged: false,
  }
}
