import { serviceUnavailable } from '../lib/errors.ts'
import type { Db } from '../lib/supabase.ts'

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

      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error)
        throw serviceUnavailable('We could not delete your account. Please try again shortly.')
    },
  }
}
