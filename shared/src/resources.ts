import { z } from 'zod'
import { guidanceDomains, type GuidanceDomain } from './profile.ts'

export const resourceKinds = ['article', 'video', 'course', 'tool'] as const
export const resourceLevels = ['beginner', 'intermediate', 'advanced'] as const
export const resourceStatuses = ['draft', 'published', 'archived'] as const

export type ResourceKind = (typeof resourceKinds)[number]
export type ResourceLevel = (typeof resourceLevels)[number]
export type ResourceStatus = (typeof resourceStatuses)[number]

/** How many resources one person can save. */
export const MAX_SAVED_RESOURCES = 200

// Cover images (stored in Cloudinary; the database keeps the id and alt text).
export const RESOURCE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const RESOURCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
/** Ids the server issues: EverGuide's folder plus a UUID (the database checks the same). */
export const RESOURCE_IMAGE_ID =
  /^everguide\/resources\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const resourceImageInputSchema = z.object({
  publicId: z.string().regex(RESOURCE_IMAGE_ID, 'Upload the image again.'),
  alt: z
    .string({ error: 'Describe the image for people who can’t see it.' })
    .trim()
    .min(1, 'Describe the image for people who can’t see it.')
    .max(200, 'Keep the description under 200 characters.'),
})

/**
 * The 11-character id of a YouTube video link, or null for anything else. Only exact
 * YouTube hosts count, so "youtube.com.example.net" or "notyoutube.com" don't.
 */
export function youtubeId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  const host = parsed.hostname.replace(/^(www\.|m\.)/, '')
  let id: string | null = null
  if (host === 'youtu.be') {
    id = parsed.pathname.split('/')[1] ?? null
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id =
      parsed.pathname === '/watch'
        ? parsed.searchParams.get('v')
        : (/^\/(?:embed|shorts|live)\/([^/]+)/.exec(parsed.pathname)?.[1] ?? null)
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

/** A URL-safe slug from a title: "Budgeting 101: Start Here!" → "budgeting-101-start-here". */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents: "Café" → "Cafe"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  return slug.length >= 3 ? slug : 'resource'
}

const httpsUrl = z
  .string({ error: 'Add a link.' })
  .trim()
  .max(500, 'Keep the link under 500 characters.')
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && url.hostname.includes('.')
    } catch {
      return false
    }
  }, 'Use a full https:// link.')

const title = z
  .string({ error: 'Add a title.' })
  .trim()
  .min(3, 'Add a title of at least 3 characters.')
  .max(160, 'Keep the title under 160 characters.')
const summary = z
  .string({ error: 'Add a summary.' })
  .trim()
  .min(10, 'Write a summary of at least 10 characters.')
  .max(600, 'Keep the summary under 600 characters.')
const sourceName = z
  .string({ error: 'Name the source.' })
  .trim()
  .min(2, 'Name the source.')
  .max(120, 'Keep the source under 120 characters.')
const duration = z.number().int().min(1).max(6000)

export const resourceCreateSchema = z.object({
  title,
  summary,
  kind: z.enum(resourceKinds),
  domain: z.enum(guidanceDomains),
  url: httpsUrl,
  sourceName,
  durationMinutes: duration.nullable().optional(),
  level: z.enum(resourceLevels).default('beginner'),
  status: z.enum(['draft', 'published']).default('draft'),
  image: resourceImageInputSchema.nullable().optional(),
})

// Written out rather than `resourceCreateSchema.partial()`: defaults would fill in
// missing fields, so a PATCH of just the title would also reset the level and status.
export const resourceUpdateSchema = z
  .object({
    title,
    summary,
    kind: z.enum(resourceKinds),
    domain: z.enum(guidanceDomains),
    url: httpsUrl,
    sourceName,
    durationMinutes: duration.nullable(),
    level: z.enum(resourceLevels),
    status: z.enum(resourceStatuses),
    /** null removes the image. */
    image: resourceImageInputSchema.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update.')

export const resourceQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  domain: z.enum(guidanceDomains).optional(),
  kind: z.enum(resourceKinds).optional(),
  level: z.enum(resourceLevels).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
})

export type ResourceCreate = z.input<typeof resourceCreateSchema>
export type ResourceUpdate = z.infer<typeof resourceUpdateSchema>
export type ResourceQuery = z.input<typeof resourceQuerySchema>
export type ResourceImageInput = z.infer<typeof resourceImageInputSchema>

/** A cover image, with sizes for responsive loading. */
export type ResourceImage = { publicId: string; src: string; srcSet: string; alt: string }

/** What the server hands the browser for one direct upload to Cloudinary. */
export type UploadTicket = { uploadUrl: string; fields: Record<string, string> }

export type Resource = {
  id: string
  slug: string
  title: string
  summary: string
  kind: ResourceKind
  domain: GuidanceDomain
  url: string
  sourceName: string
  /** Set for YouTube videos, so the page can embed them. */
  youtubeId: string | null
  durationMinutes: number | null
  level: ResourceLevel
  publishedAt: string | null
  image: ResourceImage | null
}

export type AdminResource = Resource & {
  status: ResourceStatus
  createdAt: string
  updatedAt: string
}

export type ResourcePage = { resources: Resource[]; nextOffset: number | null }
