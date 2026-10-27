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
})
