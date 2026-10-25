import { z } from 'zod'

export const MAX_RESUME_BYTES = 5 * 1024 * 1024
export const MAX_RESUME_PAGES = 20

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional()

export const resumeAnalysisRequestSchema = z.object({
  targetRole: optionalText(120, 'Keep the role under 120 characters.'),
  jobDescription: optionalText(10_000, 'Keep the job description under 10,000 characters.'),
})

export const resumeAlignments = ['strong', 'partial', 'limited', 'not_assessed'] as const

/** Size limits for the AI's report: used by the schema below, the model's schema and trimming. */
export const RESUME_REPORT_LIMITS = {
  summary: 800,
  strengths: 5,
  gaps: 6,
  suggestions: 8,
  missingKeywords: 15,
  point: 300,
  evidence: 300,
  requirement: 300,
  suggestion: 400,
  section: 60,
  keyword: 60,
} as const
const L = RESUME_REPORT_LIMITS

/** Shape the AI must return; validated on the server before saving. */
export const resumeReportSchema = z.object({
  summary: z.string().trim().min(1).max(L.summary),
  alignment: z.enum(resumeAlignments),
  strengths: z
    .array(
      z.object({
        point: z.string().trim().min(1).max(L.point),
        evidence: z.string().trim().max(L.evidence),
      }),
    )
    .max(L.strengths),
  gaps: z
    .array(
      z.object({
        requirement: z.string().trim().min(1).max(L.requirement),
        suggestion: z.string().trim().max(L.suggestion),
      }),
    )
    .max(L.gaps),
  suggestions: z
    .array(
      z.object({
        section: z.string().trim().min(1).max(L.section),
        suggestion: z.string().trim().min(1).max(L.suggestion),
      }),
    )
    .max(L.suggestions),
  missingKeywords: z.array(z.string().trim().min(1).max(L.keyword)).max(L.missingKeywords),
})

export type ResumeAnalysisRequest = z.input<typeof resumeAnalysisRequestSchema>
export type ResumeReport = z.infer<typeof resumeReportSchema>
export type ResumeAlignment = (typeof resumeAlignments)[number]

export type ResumeSummary = {
  id: string
  fileName: string
  sizeBytes: number
  pageCount: number
  createdAt: string
  analysisCount: number
}

export type ResumeAnalysis = {
  id: string
  targetRole: string | null
  jobDescription: string | null
  report: ResumeReport
  createdAt: string
}

export type ResumeDetail = ResumeSummary & { analyses: ResumeAnalysis[] }
