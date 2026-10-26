import type { AppNotification } from '@everguide/shared'
import { databaseError } from '../lib/errors.ts'
import type { Db } from '../lib/supabase.ts'
import type { UserContext } from './profile-service.ts'

export interface NotificationService {
  list(ctx: UserContext): Promise<AppNotification[]>
  /** Marks the given notifications as read, or all of them when no IDs are given. */
  markRead(ctx: UserContext, ids?: string[]): Promise<void>
}

/** In-app notifications, read and updated as the user (RLS + a column grant on read_at). */
export function createNotificationService(
  clientFor: (accessToken: string) => Db,
): NotificationService {
  return {
    async list(ctx) {
      const { data, error } = await clientFor(ctx.accessToken)
        .from('notifications')
        .select('id, type, title, body, link_path, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw databaseError(error)
      return data.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        linkPath: n.link_path,
        readAt: n.read_at,
        createdAt: n.created_at,
      }))
    },

    async markRead(ctx, ids) {
      let query = clientFor(ctx.accessToken)
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
      if (ids) query = query.in('id', ids)
      const { error } = await query
      if (error) throw databaseError(error)
    },
  }
}
