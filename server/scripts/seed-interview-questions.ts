/**
 * Load the interview question bank from database/interview/questions.json.
 * Upserts by slug, so it's safe to run again after editing the file.
 *
 *   npm run interview:seed -w @everguide/server
 */
import { readFile } from 'node:fs/promises'
import { interviewCategories, interviewDifficulties, interviewRoles } from '@everguide/shared'
import { z } from 'zod'
import { loadConfig } from '../src/config/env.ts'
import { createAdminClient } from '../src/lib/supabase.ts'

const fileSchema = z.object({
  questions: z.array(
    z.object({
      slug: z.string().regex(/^[a-z0-9-]{3,120}$/),
      category: z.enum(interviewCategories),
      role: z.enum(interviewRoles),
      difficulty: z.enum(interviewDifficulties),
      prompt: z.string().min(10).max(500),
      guidance: z.string().min(10).max(2000),
    }),
  ),
})

const admin = createAdminClient(loadConfig())
const raw = await readFile(
  new URL('../../database/interview/questions.json', import.meta.url),
  'utf8',
)
const { questions } = fileSchema.parse(JSON.parse(raw))

const slugs = new Set<string>()
for (const q of questions) {
  if (slugs.has(q.slug)) throw new Error(`Duplicate slug: ${q.slug}`)
  slugs.add(q.slug)
}

const { error } = await admin.from('interview_questions').upsert(
  questions.map((q) => ({ ...q, status: 'approved' as const })),
  { onConflict: 'slug' },
)
if (error) throw error
console.log(`Upserted ${questions.length} interview questions.`)
