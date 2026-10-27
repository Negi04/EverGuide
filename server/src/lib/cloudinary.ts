import { createHash, randomUUID } from 'node:crypto'
import type { UploadTicket } from '@everguide/shared'
import type { Config } from '../config/env.ts'

export const RESOURCE_IMAGE_FOLDER = 'everguide/resources'
/** Formats Cloudinary will accept for an upload (checked by Cloudinary, not the browser). */
export const ALLOWED_IMAGE_FORMATS = ['jpg', 'png', 'webp'] as const
const REQUEST_TIMEOUT_MS = 10_000
/** Widths for responsive images; all cropped to 16:9. */
const WIDTHS = [400, 800, 1200] as const

export type ImageInfo = { format: string; bytes: number; width: number; height: number }

export interface ImageStore {
  /** Signed parameters for the browser to upload one image straight to Cloudinary. */
  signUpload(): UploadTicket & { publicId: string }
  /** What Cloudinary actually holds under this id, or null if nothing. */
  inspect(publicId: string): Promise<ImageInfo | null>
  /** Delete an image (and clear it from Cloudinary's CDN cache). */
  destroy(publicId: string): Promise<void>
  /** Delivery URLs: resized, cropped to 16:9, best format and quality for each browser. */
  urls(publicId: string): { src: string; srcSet: string }
  /** True when the credentials are accepted. */
  ping(): Promise<boolean>
}

/**
 * Cloudinary's request signature: parameters sorted by name, joined as key=value with
 * '&', followed by the API secret, then SHA-1 (hex). `file`, `cloud_name`,
 * `resource_type` and `api_key` are never part of what is signed.
 */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex')
}

export function createImageStore(
  config: NonNullable<Config['cloudinary']>,
  now: () => number = Date.now,
): ImageStore {
  const { cloudName, apiKey, apiSecret } = config
  const api = `https://api.cloudinary.com/v1_1/${cloudName}`
  const basicAuth = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`
  const timestamp = () => Math.floor(now() / 1000)
  const deliveryUrl = (publicId: string, width: number) =>
    `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,g_auto,w_${width},h_${Math.round((width * 9) / 16)},f_auto,q_auto/${publicId}`

  return {
    signUpload() {
      // The server chooses the id, so a browser can't overwrite other images or write
      // outside EverGuide's folder; Cloudinary rejects any change to a signed value.
      const publicId = `${RESOURCE_IMAGE_FOLDER}/${randomUUID()}`
      const signed = {
        allowed_formats: ALLOWED_IMAGE_FORMATS.join(','),
        public_id: publicId,
        timestamp: timestamp(),
      }
      return {
        publicId,
        uploadUrl: `${api}/image/upload`,
        fields: {
          ...Object.fromEntries(Object.entries(signed).map(([k, v]) => [k, String(v)])),
          api_key: apiKey,
          signature: signParams(signed, apiSecret),
        },
      }
    },

    async inspect(publicId) {
      // Ids are checked against our pattern before they get here, so they're path-safe.
      const response = await fetch(`${api}/resources/image/upload/${publicId}`, {
        headers: { Authorization: basicAuth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`Cloudinary returned ${response.status}`)
      const body = (await response.json()) as ImageInfo
      return { format: body.format, bytes: body.bytes, width: body.width, height: body.height }
    },

    async destroy(publicId) {
      const signed = { invalidate: 'true', public_id: publicId, timestamp: timestamp() }
      const form = new URLSearchParams({
        ...Object.fromEntries(Object.entries(signed).map(([k, v]) => [k, String(v)])),
        api_key: apiKey,
        signature: signParams(signed, apiSecret),
      })
      const response = await fetch(`${api}/image/destroy`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`Cloudinary returned ${response.status}`)
      const { result } = (await response.json()) as { result?: string }
      if (result !== 'ok' && result !== 'not found') throw new Error(`Cloudinary said ${result}`)
    },

    urls(publicId) {
      return {
        src: deliveryUrl(publicId, 800),
        srcSet: WIDTHS.map((w) => `${deliveryUrl(publicId, w)} ${w}w`).join(', '),
      }
    },

    async ping() {
      const response = await fetch(`${api}/ping`, {
        headers: { Authorization: basicAuth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return response.ok
    },
  }
}
