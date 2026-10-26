import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness.ts'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
})

/** Expect a query to fail, returning the error so its message or code can be checked. */
async function rejects(promise: Promise<unknown>): Promise<{ message: string; code?: string }> {
  try {
    await promise
  } catch (error) {
    return error as { message: string; code?: string }
  }
  throw new Error('Expected the query to fail, but it succeeded')
}

describe('journal privacy', () => {
  it('only the writer can read, change or delete an entry', async () => {
    const writer = await t.createUser('Writer')
    const other = await t.createUser('Other')
    const id = await t.asUser(writer, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `insert into journal_entries (user_id, entry_date, mood, body)
         values ($1, '2026-10-26', 3, 'A private thought') returning id`,
        [writer],
      )
      return r.rows[0]!.id
    })

    const seenByOther = await t.asUser(other, (tx) =>
      tx.query('select * from journal_entries where id = $1', [id]),
    )
    expect(seenByOther.rows).toHaveLength(0)
    const updated = await t.asUser(other, (tx) =>
      tx.query("update journal_entries set body = 'changed' where id = $1", [id]),
    )
    expect(updated.affectedRows).toBe(0)
    const deleted = await t.asUser(other, (tx) =>
      tx.query('delete from journal_entries where id = $1', [id]),
    )
    expect(deleted.affectedRows).toBe(0)

    const anon = await rejects(t.asAnon((tx) => tx.query('select * from journal_entries')))
    expect(anon.message).toMatch(/permission denied/)

    const own = await t.asUser(writer, (tx) =>
      tx.query<{ body: string }>('select body from journal_entries where id = $1', [id]),
    )
    expect(own.rows[0]?.body).toBe('A private thought')
  })

  it("you can't write an entry into someone else's journal", async () => {
    const writer = await t.createUser('Writer')
    const victim = await t.createUser('Victim')
    const error = await rejects(
      t.asUser(writer, (tx) =>
        tx.query(
          "insert into journal_entries (user_id, entry_date, body) values ($1, '2026-10-26', 'x')",
          [victim],
        ),
      ),
    )
    expect(error.message).toMatch(/row-level security/)
  })
})

describe('habits', () => {
  it('allows one check-in per habit per day', async () => {
    const user = await t.createUser('Habit person')
    await t.asUser(user, async (tx) => {
      const habit = await tx.query<{ id: string }>(
        "insert into habits (user_id, name) values ($1, 'Walk') returning id",
        [user],
      )
      const id = habit.rows[0]!.id
      await tx.query(
        "insert into habit_checkins (habit_id, user_id, checkin_date) values ($1, $2, '2026-10-25')",
        [id, user],
      )
      const twice = await rejects(
        tx.query(
          "insert into habit_checkins (habit_id, user_id, checkin_date) values ($1, $2, '2026-10-25')",
          [id, user],
        ),
      )
      expect(twice.code).toBe('23505')
    })
  })

  it("can't check in on someone else's habit, even with your own user id", async () => {
    const owner = await t.createUser('Owner')
    const other = await t.createUser('Other')
    const habitId = await t.asUser(owner, async (tx) => {
      const r = await tx.query<{ id: string }>(
        "insert into habits (user_id, name) values ($1, 'Read') returning id",
        [owner],
      )
      return r.rows[0]!.id
    })
    // RLS passes (user_id is the caller's), but the composite key ties the check-in
    // to the habit's real owner.
    const error = await rejects(
      t.asUser(other, (tx) =>
        tx.query(
          "insert into habit_checkins (habit_id, user_id, checkin_date) values ($1, $2, '2026-10-25')",
          [habitId, other],
        ),
      ),
    )
    expect(error.code).toBe('23503')
  })
})

describe('budgets', () => {
  it('one budget per month, always dated the 1st, with items tied to the owner', async () => {
    const user = await t.createUser('Budgeter')
    const other = await t.createUser('Other')
    const notFirst = await rejects(
      t.asUser(user, (tx) =>
        tx.query("insert into budgets (user_id, month) values ($1, '2026-10-15')", [user]),
      ),
    )
    expect(notFirst.code).toBe('23514')

    const id = await t.asUser(user, async (tx) => {
      const r = await tx.query<{ id: string }>(
        "insert into budgets (user_id, month, income_paise) values ($1, '2026-10-01', 5000000) returning id",
        [user],
      )
      return r.rows[0]!.id
    })
    const duplicate = await rejects(
      t.asUser(user, (tx) =>
        tx.query("insert into budgets (user_id, month) values ($1, '2026-10-01')", [user]),
      ),
    )
    expect(duplicate.code).toBe('23505')

    const foreignItem = await rejects(
      t.asUser(other, (tx) =>
        tx.query(
          "insert into budget_items (budget_id, user_id, label, kind, planned_paise) values ($1, $2, 'Rent', 'need', 100)",
          [id, other],
        ),
      ),
    )
    expect(foreignItem.code).toBe('23503')

    const negative = await rejects(
      t.asUser(user, (tx) =>
        tx.query(
          "insert into budget_items (budget_id, user_id, label, kind, planned_paise) values ($1, $2, 'Rent', 'need', -1)",
          [id, user],
        ),
      ),
    )
    expect(negative.code).toBe('23514')
  })
})

describe('savings goals (ledger)', () => {
  async function createGoal(user: string, archived = false) {
    return t.asUser(user, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `insert into savings_goals (user_id, name, target_paise) values ($1, 'Laptop', 6000000) returning id`,
        [user],
      )
      const id = r.rows[0]!.id
      if (archived)
        await tx.query('update savings_goals set archived_at = now() where id = $1', [id])
      return id
    })
  }
  const record = (user: string, goal: string, amount: number) =>
    t.asUser(user, (tx) => tx.query('select record_savings_entry($1, $2)', [goal, amount]))
  const balance = async (goal: string) => {
    const r = await t.db.query<{ total: string }>(
      'select coalesce(sum(amount_paise), 0)::text as total from savings_entries where goal_id = $1',
      [goal],
    )
    return Number(r.rows[0]!.total)
  }

  it('records deposits and withdrawals, but never below zero', async () => {
    const user = await t.createUser('Saver')
    const goal = await createGoal(user)
    await record(user, goal, 150000)
    await record(user, goal, -50000)
    expect(await balance(goal)).toBe(100000)

    const overdraw = await rejects(record(user, goal, -100001))
    expect(overdraw.message).toMatch(/can't withdraw more/)
    expect(await balance(goal)).toBe(100000)
  })

  it('entries can only be added through the function', async () => {
    const user = await t.createUser('Saver')
    const goal = await createGoal(user)
    const direct = await rejects(
      t.asUser(user, (tx) =>
        tx.query(
          "insert into savings_entries (goal_id, user_id, amount_paise, entry_date) values ($1, $2, 100, '2026-10-26')",
          [goal, user],
        ),
      ),
    )
    expect(direct.message).toMatch(/permission denied/)
  })

  it("rejects someone else's goal as not found, and archived goals", async () => {
    const owner = await t.createUser('Owner')
    const other = await t.createUser('Other')
    const goal = await createGoal(owner)
    expect((await rejects(record(other, goal, 100))).code).toBe('P0002')

    const archived = await createGoal(owner, true)
    expect((await rejects(record(owner, archived, 100))).message).toMatch(/archived/)
  })

  it('requires a signed-in user', async () => {
    const owner = await t.createUser('Owner')
    const goal = await createGoal(owner)
    const error = await rejects(
      t.asAnon((tx) => tx.query('select record_savings_entry($1, 100)', [goal])),
    )
    expect(error.message).toMatch(/permission denied/)
  })
})

describe('resource library', () => {
  async function addResource(slug: string, title: string, summary: string, published: boolean) {
    await t.asService((tx) =>
      tx.query(
        `insert into learning_resources (slug, title, summary, kind, domain, url, source_name, status, published_at)
         values ($1, $2, $3, 'article', 'finance', 'https://example.org/' || $1, 'Example', $4, $5)`,
        [slug, title, summary, published ? 'published' : 'draft', published ? new Date() : null],
      ),
    )
  }

  beforeAll(async () => {
    await addResource('budgeting-basics', 'Budgeting basics', 'How to plan a monthly budget.', true)
    await addResource('draft-guide', 'Unfinished guide', 'Not ready for readers yet.', false)
    await addResource(
      'interview-stories',
      'Telling interview stories',
      'Structure answers with situation, task, action and result.',
      true,
    )
  })

  it('visitors see published resources only and cannot write', async () => {
    const seen = await t.asAnon((tx) =>
      tx.query<{ slug: string }>('select slug from learning_resources'),
    )
    expect(seen.rows.map((r) => r.slug).sort()).toEqual(['budgeting-basics', 'interview-stories'])

    const write = await rejects(
      t.asAnon((tx) =>
        tx.query(
          "insert into learning_resources (slug, title, summary, kind, domain, url, source_name) values ('x-x-x', 'Title', 'A summary text', 'article', 'finance', 'https://a.b', 'Src')",
        ),
      ),
    )
    expect(write.message).toMatch(/permission denied/)
  })

  it('full-text search matches word forms ("budgets" finds "budget")', async () => {
    const found = await t.asAnon((tx) =>
      tx.query<{ slug: string }>(
        "select slug from learning_resources where search @@ websearch_to_tsquery('english', 'budgets')",
      ),
    )
    expect(found.rows.map((r) => r.slug)).toEqual(['budgeting-basics'])
  })

  it('only https links are accepted', async () => {
    const error = await rejects(
      t.asService((tx) =>
        tx.query(
          "insert into learning_resources (slug, title, summary, kind, domain, url, source_name) values ('bad-link', 'Bad link', 'A summary text', 'article', 'finance', 'javascript:alert(1)', 'Src')",
        ),
      ),
    )
    expect(error.code).toBe('23514')
  })

  it('bookmarks are private', async () => {
    const a = await t.createUser('A')
    const b = await t.createUser('B')
    const resource = await t.db.query<{ id: string }>(
      "select id from learning_resources where slug = 'budgeting-basics'",
    )
    await t.asUser(a, (tx) =>
      tx.query('insert into resource_bookmarks (user_id, resource_id) values ($1, $2)', [
        a,
        resource.rows[0]!.id,
      ]),
    )
    const seenByB = await t.asUser(b, (tx) => tx.query('select * from resource_bookmarks'))
    expect(seenByB.rows).toHaveLength(0)
  })
})

describe('admin functions', () => {
  it('signed-in users cannot call them; the server can', async () => {
    const user = await t.createUser('Curious')
    const denied = await rejects(t.asUser(user, (tx) => tx.query('select admin_overview()')))
    expect(denied.message).toMatch(/permission denied/)

    const overview = await t.asService((tx) =>
      tx.query<{ admin_overview: { users: { total: number } } }>('select admin_overview()'),
    )
    expect(overview.rows[0]!.admin_overview.users.total).toBeGreaterThan(0)
  })

  it('the overview never mentions journal entries', async () => {
    const overview = await t.asService((tx) =>
      tx.query<{ admin_overview: object }>('select admin_overview()'),
    )
    expect(JSON.stringify(overview.rows[0]!.admin_overview)).not.toMatch(/journal/i)
  })

  it('sign-ups per week include empty weeks', async () => {
    const weeks = await t.asService((tx) =>
      tx.query<{ week_start: string; signups: number }>('select * from admin_signups_by_week(8)'),
    )
    expect(weeks.rows).toHaveLength(8)
    expect(Number(weeks.rows.at(-1)!.signups)).toBeGreaterThan(0)
  })
})

describe('admin roles', () => {
  async function freshAdmins(...names: string[]) {
    const db = await createTestDb()
    const ids = []
    for (const name of names) ids.push(await db.createUser(name))
    const set = (actor: string, target: string, grant: boolean) =>
      db.asService((tx) => tx.query('select set_admin_role($1, $2, $3)', [actor, target, grant]))
    const admins = async () =>
      (
        await db.db.query<{ user_id: string }>(
          "select user_id from user_roles where role = 'admin'",
        )
      ).rows.map((r) => r.user_id)
    return { db, ids, set, admins }
  }

  it('only admins can change roles, and never remove their own', async () => {
    const { db, ids, set, admins } = await freshAdmins('First admin', 'Someone')
    const [first, someone] = ids as [string, string]
    await db.db.query("insert into user_roles (user_id, role) values ($1, 'admin')", [first])

    expect((await rejects(set(someone, someone, true))).code).toBe('42501')
    await set(first, someone, true)
    expect((await admins()).sort()).toEqual([first, someone].sort())
    expect((await rejects(set(first, first, false))).message).toMatch(/your own admin role/)
    await set(first, someone, false)
    expect(await admins()).toEqual([first])
  })

  it('two admins removing each other leaves one admin, not zero', async () => {
    const { db, ids, set, admins } = await freshAdmins('A', 'B')
    const [a, b] = ids as [string, string]
    await db.db.query(
      "insert into user_roles (user_id, role) values ($1, 'admin'), ($2, 'admin')",
      [a, b],
    )
    // The lock runs these one after the other; the second caller is no longer an admin.
    await set(a, b, false)
    expect((await rejects(set(b, a, false))).code).toBe('42501')
    expect(await admins()).toEqual([a])
  })

  it('signed-in users cannot call it directly', async () => {
    const user = await t.createUser('Sneaky')
    const error = await rejects(
      t.asUser(user, (tx) => tx.query('select set_admin_role($1, $1, true)', [user])),
    )
    expect(error.message).toMatch(/permission denied/)
    const roles = await t.db.query(
      "select 1 from user_roles where user_id = $1 and role = 'admin'",
      [user],
    )
    expect(roles.rows).toHaveLength(0)
  })
})
