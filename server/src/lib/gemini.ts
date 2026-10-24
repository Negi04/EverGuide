import { GoogleGenAI } from '@google/genai'

/** Must match the vector(768) column in database/migrations/20261024000002_ai_guide.sql. */
export const EMBEDDING_DIMENSIONS = 768
const EMBED_BATCH_SIZE = 50

export interface Embedder {
  /** 'document' for knowledge-base text, 'query' for user questions (different task types). */
  embed(texts: string[], kind: 'document' | 'query'): Promise<number[][]>
}

export function normalize(vector: number[]): number[] {
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  return length === 0 ? vector : vector.map((value) => value / length)
}

export function createGenAI(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey })
}

export function createGeminiEmbedder(ai: GoogleGenAI, model: string): Embedder {
  return {
    async embed(texts, kind) {
      const vectors: number[][] = []
      for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
        const batch = texts.slice(start, start + EMBED_BATCH_SIZE)
        const response = await ai.models.embedContent({
          model,
          contents: batch,
          config: {
            taskType: kind === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY',
            outputDimensionality: EMBEDDING_DIMENSIONS,
          },
        })
        for (const embedding of response.embeddings ?? []) {
          const values = embedding.values ?? []
          if (values.length !== EMBEDDING_DIMENSIONS) {
            throw new Error(
              `Expected ${EMBEDDING_DIMENSIONS} dimensions from ${model}, got ${values.length}`,
            )
          }
          // Normalise defensively: some models return unnormalised vectors at reduced sizes.
          vectors.push(normalize(values))
        }
      }
      if (vectors.length !== texts.length)
        throw new Error('Embedding count does not match input count')
      return vectors
    },
  }
}
