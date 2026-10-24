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
})

export type Config = {
  nodeEnv: 'development' | 'test' | 'production'
  port: number
  corsOrigins: string[]
  trustProxy: number
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL']
  supabase: { url: string; anonKey: string; serviceRoleKey: string }
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
  }
}
