/**
 * Retrieval evaluation: does semantic search find the right document?
 * Reports hit@1, hit@3 and mean reciprocal rank for questions with a known answer,
 * and the best similarity reached by off-topic questions, to choose RAG_MIN_SIMILARITY.
 *
 *   npm run kb:eval -w @everguide/server
 */
import { readFile } from 'node:fs/promises'
import { loadConfig } from '../src/config/env.ts'
import { createGeminiEmbedder, createGenAI } from '../src/lib/gemini.ts'
import { createAdminClient } from '../src/lib/supabase.ts'

type EvalSet = { expected: { question: string; slug: string }[]; offTopic: string[] }

const config = loadConfig()
if (!config.ai.apiKey) {
  console.error('GEMINI_API_KEY is not set in .env')
  process.exit(1)
}
const admin = createAdminClient(config)
const embedder = createGeminiEmbedder(createGenAI(config.ai.apiKey), config.ai.embeddingModel)
const evalSet: EvalSet = JSON.parse(
  await readFile(new URL('../../database/knowledge/eval-questions.json', import.meta.url), 'utf8'),
)

const docs = await admin.from('knowledge_documents').select('id, slug')
if (docs.error) throw docs.error
const slugById = new Map(docs.data.map((d) => [d.id, d.slug]))

async function search(question: string) {
  const [vector] = await embedder.embed([question], 'query')
  const { data, error } = await admin.rpc('match_knowledge_chunks', {
    query_embedding: vector ?? [],
    match_count: 10,
    min_similarity: 0,
  })
  if (error) throw error
  // Rank documents by their best chunk.
  const ranked: { slug: string; similarity: number }[] = []
  for (const row of data) {
    const slug = slugById.get(row.document_id) ?? '?'
    if (!ranked.some((r) => r.slug === slug)) ranked.push({ slug, similarity: row.similarity })
  }
  return ranked
}

const fmt = (n: number) => n.toFixed(3)
let hit1 = 0
let hit3 = 0
let reciprocalRank = 0
const correctTopSimilarities: number[] = []

console.log('Expected questions')
for (const { question, slug } of evalSet.expected) {
  const ranked = await search(question)
  const rank = ranked.findIndex((r) => r.slug === slug) + 1
  if (rank === 1) hit1++
  if (rank >= 1 && rank <= 3) hit3++
  if (rank >= 1) reciprocalRank += 1 / rank
  const match = ranked.find((r) => r.slug === slug)
  if (match) correctTopSimilarities.push(match.similarity)
  console.log(
    `  ${rank === 1 ? 'ok  ' : 'MISS'} rank ${rank || '-'}  sim ${match ? fmt(match.similarity) : '-'}  ${question}`,
  )
}

console.log('\nOff-topic questions (best similarity should stay low)')
const offTopicBest: number[] = []
for (const question of evalSet.offTopic) {
  const [top] = await search(question)
  offTopicBest.push(top?.similarity ?? 0)
  console.log(`  sim ${fmt(top?.similarity ?? 0)}  ${question}  (closest: ${top?.slug ?? 'none'})`)
}

const n = evalSet.expected.length
const minCorrect = Math.min(...correctTopSimilarities)
const maxOffTopic = Math.max(...offTopicBest)
console.log(
  `\nhit@1 ${hit1}/${n} (${fmt(hit1 / n)})   hit@3 ${hit3}/${n} (${fmt(hit3 / n)})   MRR ${fmt(reciprocalRank / n)}`,
)
console.log(`lowest similarity of a correct document: ${fmt(minCorrect)}`)
console.log(`highest similarity of an off-topic question: ${fmt(maxOffTopic)}`)
console.log(`current RAG_MIN_SIMILARITY: ${config.ai.minSimilarity}`)
if (maxOffTopic < minCorrect) {
  console.log(
    `A threshold between ${fmt(maxOffTopic)} and ${fmt(minCorrect)} separates them on this set.`,
  )
} else {
  console.log('Correct and off-topic similarities overlap; a threshold alone cannot separate them.')
}
