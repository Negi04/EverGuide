import {
  MAX_SAVED_RESOURCES,
  slugify,
  youtubeId,
  type AdminResource,
  type GuidanceDomain,
  type Resource,
  type ResourceCreate,
  type ResourceKind,
  type ResourceLevel,
  type ResourcePage,
  type ResourceStatus,
  type ResourceUpdate,
} from '@everguide/shared'
import { AppError, databaseError } from '../lib/errors.ts'
import { fetchAllPages } from '../lib/paging.ts'
import type { Db } from '../lib/supabase.ts'
import type { UserContext } from './profile-service.ts'

export type ResourceFilters = {
  q?: string
  domain?: GuidanceDomain
  kind?: ResourceKind
  level?: ResourceLevel
  offset: number
}

export interface ResourcesService {
  list(filters: ResourceFilters): Promise<ResourcePage>
  getBySlug(slug: string): Promise<Resource>
  listSaved(ctx: UserContext): Promise<Resource[]>
  setSaved(ctx: UserContext, resourceId: string, saved: boolean): Promise<{ saved: boolean }>
  adminList(): Promise<AdminResource[]>
  create(adminId: string, input: ResourceCreate, requestId: string): Promise<AdminResource>
  update(
    adminId: string,
    resourceId: string,
    patch: ResourceUpdate,
    requestId: string,
  ): Promise<AdminResource>
  remove(adminId: string, resourceId: string, requestId: string): Promise<void>
}

const PAGE_SIZE = 24
const PUBLIC_COLUMNS =
  'id, slug, title, summary, kind, domain, url, source_name, youtube_id, duration_minutes, level, published_at'
const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, status, created_at, updated_at`
/** Ids per `.in()` filter, keeping request URLs well under gateway limits. */
const IN_CHUNK = 100

const notFound = () => new AppError(404, 'not_found', 'Resource not found.')

type PublicRow = {
  id: string
  slug: string
  title: string
  summary: string
  kind: Resource['kind']
  domain: string
  url: string
  source_name: string
  youtube_id: string | null
  duration_minutes: number | null
  level: Resource['level']
  published_at: string | null
}
type AdminRow = PublicRow & { status: ResourceStatus; created_at: string; updated_at: string }

const toResource = (row: PublicRow): Resource => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  kind: row.kind,
  domain: row.domain as Resource['domain'], // guaranteed by the CHECK constraint
  url: row.url,
  sourceName: row.source_name,
  youtubeId: row.youtube_id,
  durationMinutes: row.duration_minutes,
  level: row.level,
  publishedAt: row.published_at,
})

const toAdminResource = (row: AdminRow): AdminResource => ({
  ...toResource(row),
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

/** Videos from YouTube get an embed id; everything else opens as a link. */
const embedId = (kind: string, url: string) => (kind === 'video' ? youtubeId(url) : null)

/**
 * The resource library. Public reads use an anonymous client and saved lists the
 * user's own client, so Row Level Security hides drafts even if a filter were missing.
 * Admin writes use the service-role client after the route has checked the admin role,
 * and every change is recorded in the audit log.
 */
export function createResourcesService(
  anon: Db,
  admin: Db,
  clientFor: (accessToken: string) => Db,
): ResourcesService {
  async function audit(
    actorId: string,
    action: string,
    targetId: string,
    requestId: string,
    metadata: Record<string, unknown> = {},
  ) {
    const { error } = await admin.from('audit_events').insert({
      actor_id: actorId,
      action,
      target_type: 'learning_resource',
      target_id: targetId,
      request_id: requestId,
      metadata,
    })
    if (error) throw databaseError(error)
  }

  async function uniqueSlug(title: string): Promise<string> {
    const base = slugify(title)
    // Slugs only contain a-z, 0-9 and '-', so they're safe inside a LIKE pattern.
    const { data, error } = await admin
      .from('learning_resources')
      .select('slug')
      .like('slug', `${base}%`)
    if (error) throw databaseError(error)
    const taken = new Set(data.map((r: { slug: string }) => r.slug))
    if (!taken.has(base)) return base
    for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
  }

  async function loadAdmin(resourceId: string): Promise<AdminRow> {
    const { data, error } = await admin
      .from('learning_resources')
      .select(ADMIN_COLUMNS)
      .eq('id', resourceId)
      .maybeSingle()
    if (error) throw databaseError(error)
    if (!data) throw notFound()
    return data
  }

  return {
    async list({ q, domain, kind, level, offset }) {
      let query = anon
        .from('learning_resources')
        .select(PUBLIC_COLUMNS)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .order('id')
        // One extra row tells us whether there's another page.
        .range(offset, offset + PAGE_SIZE)
      if (domain) query = query.eq('domain', domain)
      if (kind) query = query.eq('kind', kind)
      if (level) query = query.eq('level', level)
      // websearch syntax accepts any text without errors, and matches word forms
      // ("budgets" finds "budgeting") through the stored tsvector column.
      if (q) query = query.textSearch('search', q, { type: 'websearch', config: 'english' })
      const { data, error } = await query
      if (error) throw databaseError(error)
      return {
        resources: data.slice(0, PAGE_SIZE).map(toResource),
        nextOffset: data.length > PAGE_SIZE ? offset + PAGE_SIZE : null,
      }
    },

    async getBySlug(slug) {
      const { data, error } = await anon
        .from('learning_resources')
        .select(PUBLIC_COLUMNS)
        .eq('status', 'published')
        .eq('slug', slug)
        .maybeSingle()
      if (error) throw databaseError(error)
      if (!data) throw notFound()
      return toResource(data)
    },

    async listSaved(ctx) {
      const db = clientFor(ctx.accessToken)
      let bookmarks: { resource_id: string }[]
      try {
        bookmarks = await fetchAllPages((from, to) =>
          db
            .from('resource_bookmarks')
            .select('resource_id')
            .order('created_at', { ascending: false })
            .order('resource_id')
            .range(from, to),
        )
      } catch (error) {
        throw databaseError(error)
      }
      const ids = bookmarks.map((b) => b.resource_id)
      const rows: PublicRow[] = []
      for (let i = 0; i < ids.length; i += IN_CHUNK) {
        // RLS only returns published resources, so unpublished ones drop out of the list.
        const { data, error } = await db
          .from('learning_resources')
          .select(PUBLIC_COLUMNS)
          .in('id', ids.slice(i, i + IN_CHUNK))
        if (error) throw databaseError(error)
        rows.push(...data)
      }
      const byId = new Map(rows.map((r) => [r.id, r]))
      return ids.flatMap((id) => {
        const row = byId.get(id)
        return row ? [toResource(row)] : []
      })
    },

    async setSaved(ctx, resourceId, saved) {
      const db = clientFor(ctx.accessToken)
      if (!saved) {
        const { error } = await db.from('resource_bookmarks').delete().eq('resource_id', resourceId)
        if (error) throw databaseError(error)
        return { saved: false }
      }
      const visible = await db
        .from('learning_resources')
        .select('id')
        .eq('id', resourceId)
        .maybeSingle()
      if (visible.error) throw databaseError(visible.error)
      if (!visible.data) throw notFound()
      const count = await db
        .from('resource_bookmarks')
        .select('resource_id', { count: 'exact', head: true })
      if (count.error) throw databaseError(count.error)
      if ((count.count ?? 0) >= MAX_SAVED_RESOURCES) {
        throw new AppError(
          409,
          'conflict',
          `You can save up to ${MAX_SAVED_RESOURCES} resources. Remove some first.`,
        )
      }
      const { error } = await db
        .from('resource_bookmarks')
        .upsert(
          { user_id: ctx.userId, resource_id: resourceId },
          { onConflict: 'user_id,resource_id', ignoreDuplicates: true },
        )
      if (error) throw databaseError(error)
      return { saved: true }
    },

    async adminList() {
      const { data, error } = await admin
        .from('learning_resources')
        .select(ADMIN_COLUMNS)
        .order('updated_at', { ascending: false })
        .limit(500)
      if (error) throw databaseError(error)
      return data.map(toAdminResource)
    },

    async create(adminId, input, requestId) {
      const status = input.status ?? 'draft'
      const row = {
        title: input.title,
        summary: input.summary,
        kind: input.kind,
        domain: input.domain,
        url: input.url,
        source_name: input.sourceName,
        youtube_id: embedId(input.kind, input.url),
        duration_minutes: input.durationMinutes ?? null,
        level: input.level ?? 'beginner',
        status,
        published_at: status === 'published' ? new Date().toISOString() : null,
        created_by: adminId,
      }
      let inserted = await admin
        .from('learning_resources')
        .insert({ ...row, slug: await uniqueSlug(input.title) })
        .select(ADMIN_COLUMNS)
        .single()
      if (inserted.error?.code === '23505') {
        // Another admin took the same slug at the same moment: add a random suffix.
        const suffix = crypto.randomUUID().slice(0, 6)
        inserted = await admin
          .from('learning_resources')
          .insert({ ...row, slug: `${slugify(input.title)}-${suffix}` })
          .select(ADMIN_COLUMNS)
          .single()
      }
      if (inserted.error) throw databaseError(inserted.error)
      await audit(adminId, 'resource.created', inserted.data.id, requestId, { status })
      return toAdminResource(inserted.data)
    },

    async update(adminId, resourceId, patch, requestId) {
      const existing = await loadAdmin(resourceId)
      const kind = patch.kind ?? existing.kind
      const url = patch.url ?? existing.url
      const status = patch.status ?? existing.status
      const publishedAt =
        status !== 'published'
          ? null
          : existing.status === 'published'
            ? existing.published_at
            : new Date().toISOString()
      const { data, error } = await admin
        .from('learning_resources')
        .update({
          title: patch.title,
          summary: patch.summary,
          kind: patch.kind,
          domain: patch.domain,
          url: patch.url,
          source_name: patch.sourceName,
          duration_minutes: patch.durationMinutes,
          level: patch.level,
          status: patch.status,
          youtube_id: embedId(kind, url),
          published_at: publishedAt,
        })
        .eq('id', resourceId)
        .select(ADMIN_COLUMNS)
        .single()
      if (error) throw databaseError(error)
      const action =
        status === existing.status
          ? 'resource.updated'
          : status === 'published'
            ? 'resource.published'
            : status === 'archived'
              ? 'resource.archived'
              : 'resource.unpublished'
      await audit(adminId, action, resourceId, requestId, { fields: Object.keys(patch) })
      return toAdminResource(data)
    },

    async remove(adminId, resourceId, requestId) {
      const existing = await loadAdmin(resourceId)
      const { error } = await admin.from('learning_resources').delete().eq('id', resourceId)
      if (error) throw databaseError(error)
      // The row is gone, so the audit entry keeps enough to say what it was.
      await audit(adminId, 'resource.deleted', resourceId, requestId, {
        title: existing.title,
        slug: existing.slug,
      })
    },
  }
}
