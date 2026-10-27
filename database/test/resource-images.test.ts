import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness.ts'

let t: TestDb
const validId = 'everguide/resources/2f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b'

beforeAll(async () => {
  t = await createTestDb()
})

async function insert(slug: string, image: string | null, alt: string | null) {
  return t.asService((tx) =>
    tx.query(
      `insert into learning_resources (slug, title, summary, kind, domain, url, source_name, image_public_id, image_alt)
       values ($1, 'A title', 'A summary text', 'article', 'finance', 'https://example.org', 'Example', $2, $3)`,
      [slug, image, alt],
    ),
  )
}

async function rejects(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error as { code?: string }
  }
  throw new Error('Expected the insert to fail')
}

describe('resource cover images', () => {
  it('accept an id in EverGuide’s folder with alt text, or no image at all', async () => {
    await insert('with-image', validId, 'A notebook with a monthly budget')
    await insert('without-image', null, null)
  })

  it('reject ids outside the folder or not issued by the server', async () => {
    for (const id of [
      'someone-else/2f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b',
      'everguide/resources/../avatars/x',
      'everguide/resources/my-photo',
    ]) {
      const error = await rejects(
        insert(`bad-${Math.random().toString(36).slice(2, 8)}`, id, 'Alt'),
      )
      expect(error.code, id).toBe('23514')
    }
  })

  it('require alt text with an image, and no alt text without one', async () => {
    expect((await rejects(insert('no-alt', validId, null))).code).toBe('23514')
    expect((await rejects(insert('empty-alt', validId, ''))).code).toBe('23514')
    expect((await rejects(insert('alt-only', null, 'Orphan alt text'))).code).toBe('23514')
  })
})
