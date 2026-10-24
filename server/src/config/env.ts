import { z } from 'zod'

const origins = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
  )
  .pipe(z.array(z.url()).min(1, 'List at least one allowed origin.'))

// Treat empty values (e.g. `GEMINI_CHAT_MODEL=`) as unset so defaults apply.
const blankToUndefined = (value: unknown) => (value === '' ? undefined : value)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  CORS_ORIGINS: origins,
  /** Number of reverse proxies in front of the server (e.g. 1 on Render/Railway). */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20, 'Must be the project publishable (anon) key.'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'Must be the project secret (service role) key.'),
  // AI Guide. Without a key the rest of the API still works and AI endpoints return 503.
  GEMINI_API_KEY: z.preprocess(blankToUndefined, z.string().min(20).optional()),
  GEMINI_CHAT_MODEL: z.preprocess(blankToUndefined, z.string().default('gemini-2.5-flash')),
  GEMINI_EMBEDDING_MODEL: z.preprocess(
    blankToUndefined,
    z.string().default('gemini-embedding-001'),
  ),
  AI_FREE_MONTHLY_MESSAGES: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(0).default(30),
  ),
  // Chosen from `npm run kb:eval` (2026-10-24): correct documents scored ≥ 0.670,
  // off-topic questions ≤ 0.535 with gemini-embedding-001 at 768 dims. Re-run after
  // changing the model or knowledge base.
  RAG_MIN_SIMILARITY: z.preprocess(blankToUndefined, z.coerce.number().min(0).max(1).default(0.6)),
  RAG_MATCH_COUNT: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1).max(10).default(5),
  ),
})

export type Config = {
  nodeEnv: 'development' | 'test' | 'production'
  port: number
  corsOrigins: string[]
  trustProxy: number
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL']
  supabase: { url: string; anonKey: string; serviceRoleKey: string }
  ai: {
    apiKey: string | null
    chatModel: string
    embeddingModel: string
    monthlyMessageLimit: number
    minSimilarity: number
    matchCount: number
  }
}

/**
 * Validate environment variables once at startup and fail fast with a clear list
 * of problems. Messages name the variables but never print their values.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid server configuration:\n${problems}`)
  }

  const e = parsed.data
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    corsOrigins: e.CORS_ORIGINS,
    trustProxy: e.TRUST_PROXY,
    logLevel: e.LOG_LEVEL,
    supabase: {
      url: e.SUPABASE_URL,
      anonKey: e.SUPABASE_ANON_KEY,
      serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
    },
    ai: {
      apiKey: e.GEMINI_API_KEY ?? null,
      chatModel: e.GEMINI_CHAT_MODEL,
      embeddingModel: e.GEMINI_EMBEDDING_MODEL,
      monthlyMessageLimit: e.AI_FREE_MONTHLY_MESSAGES,
      minSimilarity: e.RAG_MIN_SIMILARITY,
      matchCount: e.RAG_MATCH_COUNT,
    },
  }
}
