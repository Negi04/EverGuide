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

/** Shape the AI must return; validated on the server before saving. */
export const resumeReportSchema = z.object({
  summary: z.string().trim().min(1).max(800),
  alignment: z.enum(resumeAlignments),
  strengths: z
    .array(
      z.object({ point: z.string().trim().min(1).max(300), evidence: z.string().trim().max(300) }),
    )
    .max(5),
  gaps: z
    .array(
      z.object({
        requirement: z.string().trim().min(1).max(300),
        suggestion: z.string().trim().max(400),
      }),
    )
    .max(6),
  suggestions: z
    .array(
      z.object({
        section: z.string().trim().min(1).max(60),
        suggestion: z.string().trim().min(1).max(400),
      }),
    )
    .max(8),
  missingKeywords: z.array(z.string().trim().min(1).max(60)).max(15),
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
