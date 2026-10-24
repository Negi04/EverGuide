import { describe, expect, it } from 'vitest'
import { contactMessageSchema } from './contact.ts'

const valid = {
  name: 'Asha',
  email: 'asha@example.com',
  topic: 'general',
  message: 'I would like to know more about mentorship.',
}

describe('contactMessageSchema', () => {
  it('accepts a valid message and trims whitespace', () => {
    const result = contactMessageSchema.parse({ ...valid, name: '  Asha  ' })
    expect(result.name).toBe('Asha')
  })

  it('rejects an invalid email', () => {
    expect(contactMessageSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects an unknown topic', () => {
    expect(contactMessageSchema.safeParse({ ...valid, topic: 'sales' }).success).toBe(false)
  })

  it('rejects a message that is too short after trimming', () => {
    expect(contactMessageSchema.safeParse({ ...valid, message: '   hi   ' }).success).toBe(false)
  })
})
