import {
  interviewFeedbackSchema,
  RESUME_REPORT_LIMITS,
  resumeReportSchema,
} from '@everguide/shared'
import { describe, expect, it } from 'vitest'
import { clampText } from '../src/lib/ai-output.ts'
import { fitFeedback } from '../src/services/interview-service.ts'
import { fitReport } from '../src/services/resume-service.ts'

const long = (words: number) => Array.from({ length: words }, (_, i) => `word${i}`).join(' ')

describe('clampText', () => {
  it('leaves short text alone', () => {
    expect(clampText('  Fine as it is.  ', 50)).toBe('Fine as it is.')
  })

  it('cuts long text at a word boundary and marks the cut', () => {
    const result = clampText(long(100), 60) as string
    expect(result.length).toBeLessThanOrEqual(60)
    expect(result.endsWith('…')).toBe(true)
    expect(result.slice(0, -1)).toMatch(/word\d+$/)
  })

  it('passes non-strings through so validation can reject them', () => {
    expect(clampText(42, 10)).toBe(42)
    expect(clampText(undefined, 10)).toBeUndefined()
  })
})

describe('fitReport', () => {
  // The shape Gemini returned for a detailed real-world resume: 8 gaps and long suggestions.
  const verbose = {
    summary: long(40),
    alignment: 'partial',
    strengths: Array.from({ length: 7 }, () => ({ point: long(80), evidence: long(80) })),
    gaps: Array.from({ length: 8 }, () => ({ requirement: 'Kafka', suggestion: long(90) })),
    suggestions: Array.from({ length: 9 }, () => ({ section: 'Experience', suggestion: long(90) })),
    missingKeywords: Array.from({ length: 20 }, (_, i) => `keyword-${i}`),
  }

  it('turns an over-long report into a valid one', () => {
    expect(resumeReportSchema.safeParse(verbose).success).toBe(false)
    const report = resumeReportSchema.parse(fitReport(verbose))
    expect(report.gaps).toHaveLength(RESUME_REPORT_LIMITS.gaps)
    expect(report.strengths).toHaveLength(RESUME_REPORT_LIMITS.strengths)
    expect(report.missingKeywords).toHaveLength(RESUME_REPORT_LIMITS.missingKeywords)
    expect(report.suggestions[0]!.suggestion.length).toBeLessThanOrEqual(
      RESUME_REPORT_LIMITS.suggestion,
    )
  })

  it('keeps the first (most important) items', () => {
    const report = resumeReportSchema.parse(fitReport(verbose))
    expect(report.missingKeywords[0]).toBe('keyword-0')
  })

  it('still rejects output with the wrong shape', () => {
    expect(resumeReportSchema.safeParse(fitReport('not json')).success).toBe(false)
    expect(
      resumeReportSchema.safeParse(fitReport({ ...verbose, alignment: 'great' })).success,
    ).toBe(false)
    expect(resumeReportSchema.safeParse(fitReport({ ...verbose, gaps: 'none' })).success).toBe(
      false,
    )
    expect(
      resumeReportSchema.safeParse(fitReport({ ...verbose, strengths: [{ point: 3 }] })).success,
    ).toBe(false)
  })
})

describe('fitFeedback', () => {
  it('turns over-long feedback into valid feedback', () => {
    const raw = {
      summary: long(150),
      strengths: [long(80), long(5), long(5), long(5), long(5)],
      improvements: [long(5)],
      suggestedStructure: long(200),
    }
    expect(interviewFeedbackSchema.safeParse(raw).success).toBe(false)
    expect(interviewFeedbackSchema.safeParse(fitFeedback(raw)).success).toBe(true)
  })

  it('still rejects a missing field', () => {
    expect(interviewFeedbackSchema.safeParse(fitFeedback({ summary: 'Hi' })).success).toBe(false)
  })
})
