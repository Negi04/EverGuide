import type { z } from 'zod'
import { validationError } from './errors.ts'

/**
 * Validate untrusted input against a shared schema. Unknown keys are stripped, so a
 * client cannot sneak extra columns (like a role) into a database write.
 */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (!result.success) throw validationError(result.error)
  return result.data
}
