// Plain checks rather than Zod: this module loads on every page, and keeping Zod out
// of the main bundle saves tens of kilobytes for every visitor.
function readUrl(name: string): string {
  const value: unknown = import.meta.env[name]
  if (typeof value !== 'string' || !URL.canParse(value)) {
    throw new Error(`Missing or invalid client configuration: ${name}. See .env.example.`)
  }
  return value.replace(/\/$/, '')
}

function readKey(name: string): string {
  const value: unknown = import.meta.env[name]
  if (typeof value !== 'string' || value.length < 20) {
    throw new Error(`Missing or invalid client configuration: ${name}. See .env.example.`)
  }
  return value
}

/** Public client configuration, validated once at startup. Never put secrets in VITE_ variables. */
export const env = {
  apiUrl: readUrl('VITE_API_URL'),
  supabaseUrl: readUrl('VITE_SUPABASE_URL'),
  supabaseAnonKey: readKey('VITE_SUPABASE_ANON_KEY'),
}
