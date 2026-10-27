import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config/env.ts'

const validEnv = {
  NODE_ENV: 'production',
  PORT: '8080',
  CORS_ORIGINS: 'https://everguide.example/, https://www.everguide.example',
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_aaaaaaaaaaaaaaaaaaaa',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_bbbbbbbbbbbbbbbbbbbbbbbb',
}

describe('loadConfig', () => {
  it('parses and normalises valid configuration', () => {
    const config = loadConfig(validEnv)
    expect(config.port).toBe(8080)
    expect(config.corsOrigins).toEqual([
      'https://everguide.example',
      'https://www.everguide.example',
    ])
    expect(config.trustProxy).toBe(0)
  })

  it('lists every missing variable', () => {
    expect(() => loadConfig({})).toThrow(
      /CORS_ORIGINS[\s\S]*SUPABASE_URL[\s\S]*SUPABASE_SERVICE_ROLE_KEY/,
    )
  })

  it('never includes secret values in the error message', () => {
    const secret = 'sb_secret_THIS_MUST_NOT_BE_PRINTED'
    try {
      loadConfig({ ...validEnv, SUPABASE_URL: 'not a url', SUPABASE_SERVICE_ROLE_KEY: secret })
      expect.unreachable()
    } catch (error) {
      expect(String(error)).toMatch(/SUPABASE_URL/)
      expect(String(error)).not.toContain(secret)
    }
  })

  describe('Cloudinary', () => {
    const cloudinary = {
      CLOUDINARY_CLOUD_NAME: 'everguide-dev',
      CLOUDINARY_API_KEY: '123456789012345',
      CLOUDINARY_API_SECRET: 'super-secret-value-123',
    }

    it('is off when none of the variables are set', () => {
      expect(loadConfig(validEnv).cloudinary).toBeNull()
    })

    it('is on when all three are set', () => {
      expect(loadConfig({ ...validEnv, ...cloudinary }).cloudinary).toEqual({
        cloudName: 'everguide-dev',
        apiKey: '123456789012345',
        apiSecret: 'super-secret-value-123',
      })
    })

    it('refuses a half-set configuration, naming what is missing but no values', () => {
      const attempt = () =>
        loadConfig({
          ...validEnv,
          CLOUDINARY_CLOUD_NAME: cloudinary.CLOUDINARY_CLOUD_NAME,
          CLOUDINARY_API_SECRET: cloudinary.CLOUDINARY_API_SECRET,
        })
      expect(attempt).toThrow(/CLOUDINARY_API_KEY/)
      try {
        attempt()
      } catch (error) {
        expect((error as Error).message).not.toContain('super-secret-value-123')
      }
    })
  })

  describe('Razorpay (demo payments)', () => {
    const keys = {
      RAZORPAY_KEY_ID: 'rzp_test_AbCdEf123456',
      RAZORPAY_KEY_SECRET: 'test-secret-value-123',
    }

    it('is off when no keys are set', () => {
      expect(loadConfig(validEnv).razorpay).toBeNull()
    })

    it('accepts Test Mode keys, with or without a webhook secret', () => {
      expect(loadConfig({ ...validEnv, ...keys }).razorpay).toEqual({
        keyId: 'rzp_test_AbCdEf123456',
        keySecret: 'test-secret-value-123',
        webhookSecret: null,
      })
      expect(
        loadConfig({ ...validEnv, ...keys, RAZORPAY_WEBHOOK_SECRET: 'hook-secret' }).razorpay
          ?.webhookSecret,
      ).toBe('hook-secret')
    })

    it('refuses live keys so real money can never be charged', () => {
      const attempt = () =>
        loadConfig({ ...validEnv, ...keys, RAZORPAY_KEY_ID: 'rzp_live_AbCdEf123456' })
      expect(attempt).toThrow(/Live keys are refused/)
      try {
        attempt()
      } catch (error) {
        expect((error as Error).message).not.toContain('AbCdEf123456')
      }
    })

    it('refuses something that is not a Razorpay key id', () => {
      expect(() => loadConfig({ ...validEnv, ...keys, RAZORPAY_KEY_ID: 'abc' })).toThrow(
        /RAZORPAY_KEY_ID/,
      )
    })

    it('refuses a key id without its secret, without printing either', () => {
      const attempt = () => loadConfig({ ...validEnv, RAZORPAY_KEY_ID: keys.RAZORPAY_KEY_ID })
      expect(attempt).toThrow(/RAZORPAY_KEY_SECRET/)
      try {
        attempt()
      } catch (error) {
        expect((error as Error).message).not.toContain('AbCdEf123456')
      }
    })
  })
})
