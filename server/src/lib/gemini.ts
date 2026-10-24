import { FinishReason, GoogleGenAI, Type } from '@google/genai'

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

export type ChatTurn = { role: 'user' | 'assistant'; content: string }
export type StreamPart =
  { type: 'text'; text: string } | { type: 'usage'; inputTokens: number; outputTokens: number }

/** Thrown when the model stops because its safety filters blocked the answer. */
export class ModelBlockedError extends Error {
  constructor() {
    super('The model declined to answer')
    this.name = 'ModelBlockedError'
  }
}

export interface ChatModel {
  readonly name: string
  streamAnswer(input: {
    system: string
    history: ChatTurn[]
    prompt: string
    signal: AbortSignal
  }): AsyncIterable<StreamPart>
  suggestFollowUps(input: {
    question: string
    answer: string
    signal: AbortSignal
  }): Promise<string[]>
}

export function createGeminiChatModel(ai: GoogleGenAI, model: string): ChatModel {
  // Gemini 2.5 Flash models "think" before answering by default; for short guidance
  // answers we skip that to reduce latency and cost.
  const thinking = /^gemini-2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}

  return {
    name: model,

    async *streamAnswer({ system, history, prompt, signal }) {
      const stream = await ai.models.generateContentStream({
        model,
        contents: [
          ...history.map((turn) => ({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.content }],
          })),
          { role: 'user', parts: [{ text: prompt }] },
        ],
        config: {
          systemInstruction: system,
          temperature: 0.3,
          maxOutputTokens: 1024,
          abortSignal: signal,
          ...thinking,
        },
      })

      let usage: StreamPart | null = null
      for await (const chunk of stream) {
        const reason = chunk.candidates?.[0]?.finishReason
        if (reason === FinishReason.SAFETY || reason === FinishReason.PROHIBITED_CONTENT)
          throw new ModelBlockedError()
        const text = chunk.text
        if (text) yield { type: 'text', text }
        if (chunk.usageMetadata) {
          usage = {
            type: 'usage',
            inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
            outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
          }
        }
      }
      if (usage) yield usage
    },

    async suggestFollowUps({ question, answer, signal }) {
      const response = await ai.models.generateContent({
        model,
        contents: `Suggest up to three short follow-up questions (at most 12 words each) the user might ask next, in the same language as their question.\n\nQuestion: ${question}\n\nAnswer: ${answer}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
          temperature: 0.4,
          maxOutputTokens: 200,
          abortSignal: signal,
          ...thinking,
        },
      })
      const parsed: unknown = JSON.parse(response.text ?? '[]')
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.length <= 120)
        .slice(0, 3)
    },
  }
}
