import { describe, expect, it } from 'vitest'
import { registerSchema } from './auth.ts'

const valid = {
  fullName: 'Ravi Kumar',
  email: 'ravi@example.com',
  password: 'stronger-pass-1',
  confirmPassword: 'stronger-pass-1',
  acceptTerms: true,
}

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })

  it('reports mismatched passwords on confirmPassword', () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: 'different-pass-1' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it('requires a number in the password', () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: 'onlyletters',
      confirmPassword: 'onlyletters',
    })
    expect(result.success).toBe(false)
  })

  it('requires the terms to be accepted', () => {
    expect(registerSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false)
  })
})
