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
    expect(config.corsOrigins).toEqual(['https://everguide.example', 'https://www.everguide.example'])
    expect(config.trustProxy).toBe(0)
  })

  it('lists every missing variable', () => {
    expect(() => loadConfig({})).toThrow(/CORS_ORIGINS[\s\S]*SUPABASE_URL[\s\S]*SUPABASE_SERVICE_ROLE_KEY/)
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
})
