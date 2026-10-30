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

// Deleting an account also deletes its events (migration 8), so this is all the cleanup needed.
afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id)
})

async function createAccount(fullName: string) {
  const email = `everguide-outbox-${Date.now()}@example.com`
  const password = `Outbox-${crypto.randomUUID()}`
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (created.error) throw created.error
  userIds.push(created.data.user.id)
  return { id: created.data.user.id, email, password }
}

const welcomeEvents = (id: string) =>
  admin
    .from('outbox_events')
    .select('event_type, status, payload')
    .eq('dedupe_key', `user.welcome:${id}`)

describe('outbox', () => {
  it('a sign-up queues one welcome event, which the user cannot read', async () => {
    const { id, email, password } = await createAccount('Outbox Tester')

    const { data: queued, error } = await welcomeEvents(id)
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

  it('deleting the account deletes its events', async () => {
    const { id } = await createAccount('Forget Me')
    expect((await welcomeEvents(id)).data).toHaveLength(1)

    const deleted = await admin.auth.admin.deleteUser(id)
    expect(deleted.error).toBeNull()
    expect((await welcomeEvents(id)).data).toEqual([])
  })
})
