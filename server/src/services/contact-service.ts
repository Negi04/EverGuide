import type { ContactMessage } from '@everguide/shared'
import { serviceUnavailable } from '../lib/errors.ts'
import type { Db } from '../lib/supabase.ts'

export interface ContactService {
  submit(message: ContactMessage): Promise<{ id: string }>
}

/** contact_messages has no client policies, so the server writes with the service role. */
export function createContactService(admin: Db): ContactService {
  return {
    async submit(message) {
      const { data, error } = await admin
        .from('contact_messages')
        .insert({
          name: message.name,
          email: message.email,
          topic: message.topic,
          message: message.message,
        })
        .select('id')
        .single()
      if (error)
        throw serviceUnavailable('We could not save your message. Please try again shortly.')
      return { id: data.id }
    },
  }
}
