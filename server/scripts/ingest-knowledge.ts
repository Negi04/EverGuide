/**
 * Load the curated knowledge base into Supabase:
 *   read Markdown → validate front matter → chunk → embed → store.
 * Runs separately from the chat API, so slow embedding work never delays users.
 *
 *   npm run kb:ingest -w @everguide/server
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig } from '../src/config/env.ts'
import { createGeminiEmbedder, createGenAI } from '../src/lib/gemini.ts'
import { createAdminClient } from '../src/lib/supabase.ts'
import { chunkMarkdown, embeddingText } from '../src/rag/chunker.ts'
import { parseKnowledgeFile } from '../src/rag/front-matter.ts'

const KNOWLEDGE_DIR = new URL('../../database/knowledge/', import.meta.url).pathname

const config = loadConfig()
if (!config.ai.apiKey) {
  console.error('GEMINI_API_KEY is not set in .env')
  process.exit(1)
}
const admin = createAdminClient(config)
const embedder = createGeminiEmbedder(createGenAI(config.ai.apiKey), config.ai.embeddingModel)

const files = (await readdir(KNOWLEDGE_DIR))
  .filter((name) => name.endsWith('.md') && name !== 'README.md')
  .sort()
const seenSlugs = new Set<string>()
let updated = 0
let skipped = 0
let totalChunks = 0

for (const file of files) {
  const raw = await readFile(join(KNOWLEDGE_DIR, file), 'utf8')
  const { meta, body } = parseKnowledgeFile(raw)
  if (seenSlugs.has(meta.slug)) throw new Error(`Duplicate slug "${meta.slug}" in ${file}`)
  seenSlugs.add(meta.slug)

  // The checksum covers the file and the embedding model, so switching models re-embeds.
  const checksum = createHash('sha256').update(config.ai.embeddingModel).update(raw).digest('hex')
  const existing = await admin
    .from('knowledge_documents')
    .select('id, checksum')
    .eq('slug', meta.slug)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data?.checksum === checksum) {
    skipped++
    console.log(`skip     ${meta.slug} (unchanged)`)
    continue
  }

  const chunks = chunkMarkdown(body)
  const vectors = await embedder.embed(
    chunks.map((chunk) => embeddingText(meta.title, chunk)),
    'document',
  )

  // Mark the document as pending until its chunks are stored, so an interrupted run
  // is retried next time instead of leaving a document with missing chunks.
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

  updated++
  totalChunks += chunks.length
  console.log(`ingest   ${meta.slug} (${chunks.length} chunks, ${meta.status})`)
}

const all = await admin.from('knowledge_documents').select('slug, status')
for (const doc of all.data ?? []) {
  if (!seenSlugs.has(doc.slug))
    console.warn(`warning  ${doc.slug} is in the database but has no file (status: ${doc.status})`)
}

console.log(`\nDone: ${updated} ingested (${totalChunks} chunks), ${skipped} unchanged.`)
