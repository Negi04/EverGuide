import { describe, expect, it } from 'vitest'
import { createImageStore, signParams } from '../src/lib/cloudinary.ts'

const config = { cloudName: 'demo-cloud', apiKey: '123456789012345', apiSecret: 'abcd' }

describe('Cloudinary signatures', () => {
  it('match the worked example in Cloudinary’s documentation', () => {
    expect(
      signParams(
        {
          timestamp: 1315060510,
          public_id: 'sample_image',
          eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
        },
        'abcd',
      ),
    ).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e')
  })

  it('change when any signed value changes', () => {
    const base = { public_id: 'a', timestamp: 1 }
    expect(signParams(base, 'abcd')).not.toBe(signParams({ ...base, public_id: 'b' }, 'abcd'))
    expect(signParams(base, 'abcd')).not.toBe(signParams(base, 'other-secret'))
  })
})

describe('upload tickets', () => {
  const store = createImageStore(config, () => 1_800_000_000_000)

  it('fix the id, formats and time, and are signed with the secret', () => {
    const ticket = store.signUpload()
    expect(ticket.uploadUrl).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload')
    expect(ticket.publicId).toMatch(/^everguide\/resources\/[0-9a-f-]{36}$/)
    expect(ticket.fields).toMatchObject({
      public_id: ticket.publicId,
      allowed_formats: 'jpg,png,webp',
      timestamp: '1800000000',
      api_key: '123456789012345',
    })
    expect(ticket.fields.signature).toBe(
      signParams(
        { allowed_formats: 'jpg,png,webp', public_id: ticket.publicId, timestamp: 1800000000 },
        'abcd',
      ),
    )
  })

  it('never contain the secret', () => {
    expect(JSON.stringify(store.signUpload())).not.toContain('abcd')
  })

  it('use a fresh id every time', () => {
    expect(store.signUpload().publicId).not.toBe(store.signUpload().publicId)
  })
})

describe('delivery URLs', () => {
  it('offer 16:9 crops in three widths with automatic format and quality', () => {
    const { src, srcSet } = createImageStore(config).urls('everguide/resources/x')
    expect(src).toBe(
      'https://res.cloudinary.com/demo-cloud/image/upload/c_fill,g_auto,w_800,h_450,f_auto,q_auto/everguide/resources/x',
    )
    expect(srcSet.split(', ').map((s) => s.split(' ')[1])).toEqual(['400w', '800w', '1200w'])
    expect(srcSet).toContain('w_1200,h_675')
  })
})
