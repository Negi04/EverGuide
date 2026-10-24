import type { Embedder } from '../lib/gemini.ts'
import type { Db } from '../lib/supabase.ts'

export type RetrievedChunk = {
  chunkId: string
  documentId: string
  title: string
  sourceName: string
  sourceUrl: string | null
  heading: string | null
  content: string
  similarity: number
}

export interface Retriever {
  search(question: string): Promise<RetrievedChunk[]>
}

/** Embed the question and find the closest approved chunks above the similarity threshold. */
export function createRetriever(
  admin: Db,
  embedder: Embedder,
  options: { matchCount: number; minSimilarity: number },
): Retriever {
  return {
    async search(question) {
      const [vector] = await embedder.embed([question], 'query')
      const { data, error } = await admin.rpc('match_knowledge_chunks', {
        query_embedding: vector ?? [],
        match_count: options.matchCount,
        min_similarity: options.minSimilarity,
      })
      if (error) throw new Error(`Knowledge search failed: ${error.message}`)
      return data.map((row) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        title: row.title,
        sourceName: row.source_name,
        sourceUrl: row.source_url,
        heading: row.heading,
        content: row.content,
        similarity: row.similarity,
      }))
    },
  }
}
