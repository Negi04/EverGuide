import { describe, expect, it } from 'vitest'
import { resourceCreateSchema, resourceUpdateSchema, slugify, youtubeId } from './resources.ts'

describe('youtubeId', () => {
  it('reads every common YouTube link format', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ])
      expect(youtubeId(url), url).toBe('dQw4w9WgXcQ')
  })

  it('ignores look-alike hosts, plain http and malformed ids', () => {
    for (const url of [
      'https://youtube.com.example.net/watch?v=dQw4w9WgXcQ',
      'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
      'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>',
      'https://www.youtube.com/channel/UC123',
      'not a url',
    ])
      expect(youtubeId(url), url).toBeNull()
  })
})

describe('slugify', () => {
  it('makes readable, URL-safe slugs', () => {
    expect(slugify('Budgeting 101: Start Here!')).toBe('budgeting-101-start-here')
    expect(slugify('  Café — résumé tips  ')).toBe('cafe-resume-tips')
    expect(slugify('A'.repeat(200))).toHaveLength(80)
  })

  it('falls back when nothing usable is left', () => {
    expect(slugify('!!')).toBe('resource')
    expect(slugify('நேர்காணல்')).toBe('resource')
  })
})

describe('resource validation', () => {
  const valid = {
    title: 'How to budget',
    summary: 'A short guide to planning a monthly budget.',
    kind: 'article',
    domain: 'finance',
    url: 'https://example.org/budget',
    sourceName: 'Example',
  }

  it('accepts https links only', () => {
    expect(resourceCreateSchema.safeParse(valid).success).toBe(true)
    for (const url of [
      'http://example.org',
      'javascript:alert(1)',
      'https://localhost',
      'example.org',
    ])
      expect(resourceCreateSchema.safeParse({ ...valid, url }).success, url).toBe(false)
  })

  it('new resources default to draft, beginner', () => {
    expect(resourceCreateSchema.parse(valid)).toMatchObject({ status: 'draft', level: 'beginner' })
  })

  it('an update of one field changes only that field', () => {
    // A .partial() of the create schema would add level: 'beginner' and status: 'draft' here.
    expect(resourceUpdateSchema.parse({ title: 'New title' })).toEqual({ title: 'New title' })
  })
})
