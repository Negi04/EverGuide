import { serviceUnavailable } from '../lib/errors.ts'
import type { Db } from '../lib/supabase.ts'
import { RESUME_BUCKET } from './resume-service.ts'

export interface AccountService {
  /** Permanently deletes the user. Their rows are removed by ON DELETE CASCADE. */
  deleteAccount(userId: string, requestId: string): Promise<void>
}

export function createAccountService(admin: Db): AccountService {
  return {
    async deleteAccount(userId, requestId) {
      // Record the deletion first. actor_id becomes null when the profile is removed,
      // but target_id keeps the ID so the event stays traceable.
      const audit = await admin.from('audit_events').insert({
        actor_id: userId,
        action: 'account.deleted',
        target_type: 'user',
        target_id: userId,
        request_id: requestId,
      })
      if (audit.error) throw serviceUnavailable()

      // Database rows are removed by ON DELETE CASCADE, but stored files are not. Remove
      // them first: once the account is gone, nothing would point to them any more.
      const files = await admin.storage.from(RESUME_BUCKET).list(userId, { limit: 1000 })
      if (files.error) throw serviceUnavailable()
      if (files.data.length > 0) {
        const removed = await admin.storage
          .from(RESUME_BUCKET)
          .remove(files.data.map((file) => `${userId}/${file.name}`))
        if (removed.error) throw serviceUnavailable()
      }

      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error)
        throw serviceUnavailable('We could not delete your account. Please try again shortly.')
    },
  }
}
