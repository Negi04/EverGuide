import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { ResumeService } from '../src/services/resume-service.ts'
import { makePdf, sampleResumeLines } from './fixtures/make-pdf.ts'
import { buildTestApp, VALID_TOKEN } from './helpers.ts'

const auth = { Authorization: `Bearer ${VALID_TOKEN}` }

function fakeResumes(uploads: { name?: string; data: Buffer }[] = []): ResumeService {
  return {
    list: async () => [],
    get: async () => {
      throw new Error('not used')
    },
    upload: async (_ctx, file) => {
      uploads.push(file)
      return {
        id: 'r1',
        fileName: 'cv.pdf',
        sizeBytes: file.data.length,
        pageCount: 1,
        createdAt: '2026-10-25T00:00:00Z',
        analysisCount: 0,
      }
    },
    remove: async () => {},
    analyse: async () => {
      throw new Error('not used')
    },
  }
}

describe('resume upload route', () => {
  it('requires a signed-in user', async () => {
    const { app } = buildTestApp({ resumes: fakeResumes() })
    const res = await request(app)
      .post('/api/v1/resumes')
      .set('Content-Type', 'application/pdf')
      .send(makePdf([sampleResumeLines]))
    expect(res.status).toBe(401)
  })

  it('passes the raw PDF and file name to the service', async () => {
    const uploads: { name?: string; data: Buffer }[] = []
    const { app } = buildTestApp({ resumes: fakeResumes(uploads) })
    const pdf = makePdf([sampleResumeLines])
    const res = await request(app)
      .post('/api/v1/resumes')
      .set(auth)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', encodeURIComponent('Asha Rao CV.pdf'))
      .send(pdf)
    expect(res.status).toBe(201)
    expect(uploads[0]?.data.equals(pdf)).toBe(true)
    expect(uploads[0]?.name).toBe('Asha%20Rao%20CV.pdf')
  })

  it('rejects uploads that are not sent as PDF', async () => {
    const { app } = buildTestApp({ resumes: fakeResumes() })
    const res = await request(app).post('/api/v1/resumes').set(auth).send({ file: 'not a pdf' })
    expect(res.status).toBe(400)
  })

  it('rejects files over 5 MB before they reach the service', async () => {
    const uploads: { name?: string; data: Buffer }[] = []
    const { app } = buildTestApp({ resumes: fakeResumes(uploads) })
    const res = await request(app)
      .post('/api/v1/resumes')
      .set(auth)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(5 * 1024 * 1024 + 10, 1))
    expect(res.status).toBe(413)
    expect(uploads).toHaveLength(0)
  })

  it('limits how many uploads can be made', async () => {
    const { app } = buildTestApp({
      resumes: fakeResumes(),
      rateLimits: { resumeUploads: { windowMs: 60_000, limit: 1 } },
    })
    const send = () =>
      request(app)
        .post('/api/v1/resumes')
        .set(auth)
        .set('Content-Type', 'application/pdf')
        .send(makePdf([sampleResumeLines]))
    await send()
    expect((await send()).status).toBe(429)
  })
})
