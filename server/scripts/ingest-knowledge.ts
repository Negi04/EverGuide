/**
 * Load the curated knowledge base into Supabase:
 *   read Markdown → validate front matter → chunk → embed → store.
 * Runs separately from the chat API, so slow embedding work never delays users.
 *
 *   npm run kb:ingest -w @everguide/server
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig } from '../src/config/env.ts'
import { createGeminiEmbedder, createGenAI } from '../src/lib/gemini.ts'
import { createAdminClient } from '../src/lib/supabase.ts'
import { ingestDocument } from '../src/rag/ingest.ts'

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
  const result = await ingestDocument(admin, embedder, config.ai.embeddingModel, raw)
  if (seenSlugs.has(result.slug)) throw new Error(`Duplicate slug "${result.slug}" in ${file}`)
  seenSlugs.add(result.slug)
  if (result.unchanged) {
    skipped++
    console.log(`skip     ${result.slug} (unchanged)`)
  } else {
    updated++
    totalChunks += result.chunks
    console.log(`ingest   ${result.slug} (${result.chunks} chunks)`)
  }
}

const all = await admin.from('knowledge_documents').select('slug, status')
for (const doc of all.data ?? []) {
  if (!seenSlugs.has(doc.slug))
    console.warn(`warning  ${doc.slug} is in the database but has no file (status: ${doc.status})`)
}

console.log(`\nDone: ${updated} ingested (${totalChunks} chunks), ${skipped} unchanged.`)
