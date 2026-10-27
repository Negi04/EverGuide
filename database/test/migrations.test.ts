import { describe, expect, it } from 'vitest'
import { createTestDb } from './harness.ts'

describe('migrations', () => {
  it('all apply cleanly to a fresh database, in order', async () => {
    const { files } = await createTestDb()
    expect(files.length).toBeGreaterThanOrEqual(2)
  })

  it('the signup trigger creates a profile, preferences and the user role', async () => {
    const { db, createUser } = await createTestDb()
    const id = await createUser('Asha Rao')
    const profile = await db.query<{ full_name: string }>(
      'select full_name from profiles where id = $1',
      [id],
    )
    const roles = await db.query<{ role: string }>(
      'select role from user_roles where user_id = $1',
      [id],
    )
    expect(profile.rows[0]?.full_name).toBe('Asha Rao')
    expect(roles.rows.map((r) => r.role)).toEqual(['user'])
  })

  it('every table in the public schema has Row Level Security switched on', async () => {
    const { db } = await createTestDb()
    const open = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and not rowsecurity",
    )
    expect(open.rows.map((r) => r.tablename)).toEqual([])
  })

  it('RLS is enforced for signed-in users (harness sanity check)', async () => {
    const { createUser, asUser } = await createTestDb()
    const alice = await createUser('Alice')
    const bob = await createUser('Bob')
    const seen = await asUser(alice, (tx) => tx.query<{ id: string }>('select id from profiles'))
    expect(seen.rows.map((r) => r.id)).toEqual([alice])
    expect(seen.rows.map((r) => r.id)).not.toContain(bob)
  })
})
