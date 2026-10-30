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
  // Image uploads (resource covers). All three or none: without them uploads are off.
  CLOUDINARY_CLOUD_NAME: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^[a-z0-9_-]+$/i, 'Must be your Cloudinary cloud name.')
      .optional(),
  ),
  CLOUDINARY_API_KEY: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^\d{6,20}$/, 'Must be your Cloudinary API key (digits).')
      .optional(),
  ),
  CLOUDINARY_API_SECRET: z.preprocess(blankToUndefined, z.string().min(10).optional()),
  // Demo payments (Razorpay Test Mode). Key id and secret together, or neither.
  RAZORPAY_KEY_ID: z.preprocess(
    blankToUndefined,
    z
      .string()
      .refine((value) => !value.startsWith('rzp_live_'), {
        message:
          'Live keys are refused: EverGuide only takes Razorpay Test Mode keys (rzp_test_…), so no real money can be charged.',
      })
      .pipe(
        z
          .string()
          .regex(/^rzp_test_[A-Za-z0-9]+$/, 'Must be a Razorpay Test Mode key id (rzp_test_…).'),
      )
      .optional(),
  ),
  RAZORPAY_KEY_SECRET: z.preprocess(blankToUndefined, z.string().min(10).optional()),
  // Optional: without it the webhook endpoint answers 503 and checkout still works.
  RAZORPAY_WEBHOOK_SECRET: z.preprocess(blankToUndefined, z.string().min(8).optional()),
  // Automation: where to send signed events (an n8n Webhook node), and the shared secret.
  N8N_WEBHOOK_URL: z.preprocess(blankToUndefined, z.url().optional()),
  N8N_WEBHOOK_SECRET: z.preprocess(
    blankToUndefined,
    z.string().min(32, 'Use at least 32 random characters.').optional(),
  ),
})

const CLOUDINARY_VARS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const

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
  /** Null when image uploads aren't configured. */
  cloudinary: { cloudName: string; apiKey: string; apiSecret: string } | null
  /** Null when demo payments aren't configured. Always Test Mode keys. */
  razorpay: { keyId: string; keySecret: string; webhookSecret: string | null } | null
  /** Null when automation isn't configured: events then wait in the outbox. */
  automation: { webhookUrl: string; secret: string } | null
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
  // Some but not all Cloudinary variables is almost certainly a mistake, not a choice.
  const missing = CLOUDINARY_VARS.filter((name) => !e[name])
  if (missing.length > 0 && missing.length < CLOUDINARY_VARS.length) {
    throw new Error(
      `Invalid server configuration:\n  - set ${missing.join(', ')} too, or none of the CLOUDINARY_* variables to turn image uploads off.`,
    )
  }

  if (Boolean(e.RAZORPAY_KEY_ID) !== Boolean(e.RAZORPAY_KEY_SECRET)) {
    throw new Error(
      `Invalid server configuration:\n  - set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or neither to turn demo payments off.`,
    )
  }

  if (Boolean(e.N8N_WEBHOOK_URL) !== Boolean(e.N8N_WEBHOOK_SECRET)) {
    throw new Error(
      `Invalid server configuration:\n  - set both N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET, or neither to turn automation off.`,
    )
  }

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
    cloudinary:
      e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET
        ? {
            cloudName: e.CLOUDINARY_CLOUD_NAME,
            apiKey: e.CLOUDINARY_API_KEY,
            apiSecret: e.CLOUDINARY_API_SECRET,
          }
        : null,
    razorpay:
      e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET
        ? {
            keyId: e.RAZORPAY_KEY_ID,
            keySecret: e.RAZORPAY_KEY_SECRET,
            webhookSecret: e.RAZORPAY_WEBHOOK_SECRET ?? null,
          }
        : null,
    automation:
      e.N8N_WEBHOOK_URL && e.N8N_WEBHOOK_SECRET
        ? { webhookUrl: e.N8N_WEBHOOK_URL, secret: e.N8N_WEBHOOK_SECRET }
        : null,
  }
}
