import { databaseError } from '../lib/errors.ts'
import type { Db } from '../lib/supabase.ts'

/**
 * The monthly AI allowance shared by every AI feature (Guide answers, interview
 * feedback, resume analysis). Reservations are atomic in the database
 * (reserve_ai_message) and refunded with fail() if the work doesn't finish.
 */
export interface UsageMeter {
  reserve(
    userId: string,
    monthlyLimit: number,
  ): Promise<{ reservationId: string | null; used: number }>
  complete(
    reservationId: string,
    details: {
      messageId?: string | null
      model: string
      inputTokens: number
      outputTokens: number
    },
  ): Promise<void>
  fail(reservationId: string): Promise<void>
}

export function createUsageMeter(admin: Db): UsageMeter {
  return {
    async reserve(userId, monthlyLimit) {
      const { data, error } = await admin.rpc('reserve_ai_message', {
        p_user_id: userId,
        p_monthly_limit: monthlyLimit,
      })
      if (error) throw databaseError(error)
      const row = data[0]
      return { reservationId: row?.reservation_id ?? null, used: row?.used ?? 0 }
    },

    async complete(reservationId, details) {
      const { error } = await admin
        .from('ai_usage')
        .update({
          status: 'completed',
          message_id: details.messageId ?? null,
          model: details.model,
          input_tokens: details.inputTokens,
          output_tokens: details.outputTokens,
        })
        .eq('id', reservationId)
      if (error) throw databaseError(error)
    },

    async fail(reservationId) {
      const { error } = await admin
        .from('ai_usage')
        .update({ status: 'failed' })
        .eq('id', reservationId)
      if (error) throw databaseError(error)
    },
  }
}
