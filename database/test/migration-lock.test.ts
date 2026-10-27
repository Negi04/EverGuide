import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url)

/**
 * Fingerprints of migrations already applied to the Supabase project. An applied
 * migration must never change: the database won't re-run it, so an edit would make
 * the repository disagree with the real schema. To change the schema, add a new
 * migration. After the user applies a new one, add its fingerprint here.
 */
const APPLIED: Record<string, string> = {
  '20261024000001_identity_and_onboarding.sql':
    '5255e68a2b4724f8357ee7d282ef1bee3fd2256d6d3942ca5f1bf69ebc763be2',
  '20261024000002_ai_guide.sql': 'e206c53d9fd0cf768c395b159c0627db442adb41ca6142755f4c7f1ff838d3b7',
  '20261025000003_career_and_mentors.sql':
    'e88acaf25e7e6044f7a99afdc6d7a0ec068bd7bdd977f9e7b47b026a11eb285e',
  '20261026000004_wellness_finance_admin.sql':
    '54547c6dd48a9ae994e462ecdd6e8d7b8ca1377da0fa3149684155fc09bd69fd',
  '20261027000005_resource_images.sql':
    '128508a53391f235a0f9ddf16f5faa10ff81dfb6c9ce529b9607235136a1838b',
  '20261027000006_demo_billing.sql':
    'd78ac18cb81264fbdc023217ff30e832afb93e68f0ab9cbb8da40886c1f68f8b',
}

const sha256 = (file: string) =>
  createHash('sha256')
    .update(readFileSync(new URL(file, MIGRATIONS_DIR)))
    .digest('hex')

describe('applied migrations', () => {
  it.each(Object.keys(APPLIED))('%s is unchanged since it was applied', (file) => {
    expect(
      sha256(file),
      `${file} was edited after being applied. Restore it (git checkout) and put the change in a new migration.`,
    ).toBe(APPLIED[file])
  })

  it('new migrations sort after every applied one', () => {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()
    const lastApplied = Object.keys(APPLIED).sort().at(-1)!
    const unapplied = files.filter((f) => !(f in APPLIED))
    for (const file of unapplied) expect(file > lastApplied).toBe(true)
  })
})
