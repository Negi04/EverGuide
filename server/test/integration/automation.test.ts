/**
 * The outbox against the real database. Only this test's own events are touched:
 * claiming events here would also take real ones, so delivery is tested elsewhere
 * (unit tests with fakes, and by hand against a real n8n).
 */
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { afterAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/config/env.ts'
import { createAdminClient } from '../../src/lib/supabase.ts'

if (existsSync('../.env')) process.loadEnvFile('../.env')
const config = loadConfig({ ...process.env, NODE_ENV: 'test' })
const admin = createAdminClient(config)
const userIds: string[] = []

afterAll(async () => {
  for (const id of userIds) {
    await admin.from('outbox_events').delete().eq('dedupe_key', `user.welcome:${id}`)
    await admin.auth.admin.deleteUser(id)
  }
})

describe('outbox', () => {
  it('a sign-up queues one welcome event, which the user cannot read', async () => {
    const email = `everguide-outbox-${Date.now()}@example.com`
    const password = `Outbox-${crypto.randomUUID()}`
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Outbox Tester' },
    })
    if (created.error) throw created.error
    const id = created.data.user.id
    userIds.push(id)

    const { data: queued, error } = await admin
      .from('outbox_events')
      .select('event_type, status, payload')
      .eq('dedupe_key', `user.welcome:${id}`)
    expect(error).toBeNull()
    expect(queued).toHaveLength(1)
    expect(queued![0]).toMatchObject({
      event_type: 'user.welcome',
      payload: { userId: id, firstName: 'Outbox' },
    })
    // A running API with n8n configured may already be sending it.
    expect(['pending', 'sending', 'sent']).toContain(queued![0]!.status)

    const browser = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { persistSession: false },
    })
    await browser.auth.signInWithPassword({ email, password })
    const peek = await browser.from('outbox_events').select('id').limit(1)
    expect(peek.error?.message).toMatch(/permission denied/)
  })
})
