/**
 * Check the Cloudinary settings in .env by asking Cloudinary whether it accepts them.
 * Prints only whether they work, never the values.
 *
 *   npm run cloudinary:check -w @everguide/server
 */
import { loadConfig } from '../src/config/env.ts'
import { createImageStore } from '../src/lib/cloudinary.ts'

let config: ReturnType<typeof loadConfig>
try {
  config = loadConfig()
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}

if (!config.cloudinary) {
  console.log(
    'Cloudinary: not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to .env.',
  )
  process.exit(1)
}

const ok = await createImageStore(config.cloudinary)
  .ping()
  .catch(() => false)
console.log(
  ok
    ? 'Cloudinary: connected. The credentials were accepted.'
    : 'Cloudinary: not connected. Check the cloud name, API key and API secret (or your network).',
)
process.exit(ok ? 0 : 1)
