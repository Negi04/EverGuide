/**
 * Check the Cloudinary settings in .env: connect, then upload, read and delete a tiny
 * test image. Prints only whether each step works, never the values.
 *
 *   npm run cloudinary:check -w @everguide/server
 */
import { loadConfig } from '../src/config/env.ts'
import { createImageStore } from '../src/lib/cloudinary.ts'
import { makePng } from '../test/fixtures/make-png.ts'

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

const store = createImageStore(config.cloudinary)
if (!(await store.ping().catch(() => false))) {
  console.log(
    'Cloudinary: not connected. Check the cloud name, API key and API secret (or your network).',
  )
  process.exit(1)
}

// Connecting isn't enough: the key must also be allowed to upload, read and delete
// (new API keys start with no permissions). Try all three with a tiny test image.
const ticket = store.signUpload()
const form = new FormData()
for (const [key, value] of Object.entries(ticket.fields)) form.set(key, value)
form.set('file', new Blob([makePng(400, 225)], { type: 'image/png' }), 'check.png')
const response = await fetch(ticket.uploadUrl, { method: 'POST', body: form })
const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
if (!response.ok) {
  console.log(`Cloudinary: connected, but uploading was refused (HTTP ${response.status}).`)
  console.log(`  Cloudinary says: ${body.error?.message ?? 'no details'}`)
  if (response.status === 403)
    console.log(
      '  This API key lacks permissions. Use the root API key, or give this key a role that can create, read and delete assets.',
    )
  process.exit(1)
}
const found = await store.inspect(ticket.publicId).catch(() => null)
await store.destroy(ticket.publicId)
const gone = (await store.inspect(ticket.publicId).catch(() => 'error')) === null
console.log(
  found && gone
    ? 'Cloudinary: ready. Upload, read and delete all work (the test image was removed).'
    : 'Cloudinary: uploaded, but reading or deleting failed. Check the key’s permissions.',
)
process.exit(found && gone ? 0 : 1)
