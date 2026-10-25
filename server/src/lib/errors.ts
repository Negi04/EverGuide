import type { ApiErrorBody, ApiErrorCode } from '@everguide/shared'
import { ZodError } from 'zod'

type ErrorDetails = NonNullable<ApiErrorBody['error']['details']>

/** An error that is safe to show to the client, with an HTTP status and stable code. */
export class AppError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details?: ErrorDetails

  constructor(status: number, code: ApiErrorCode, message: string, details?: ErrorDetails) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const unauthorized = (message = 'Please sign in to continue.') =>
  new AppError(401, 'unauthorized', message)

export const forbidden = (message = 'You do not have permission to do that.') =>
  new AppError(403, 'forbidden', message)

export const serviceUnavailable = (
  message = 'A service we depend on is unavailable. Please try again shortly.',
) => new AppError(503, 'service_unavailable', message)

/** Hide database details from the client, but keep them on `cause` for the server logs. */
export function databaseError(cause: unknown): AppError {
  const error = serviceUnavailable()
  error.cause = cause
  return error
}

export function validationError(error: ZodError): AppError {
  return new AppError(
    400,
    'validation_failed',
    'Some fields are invalid.',
    error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  )
}

/** Errors thrown by express.json() carry a `type` from body-parser. */
function isBodyParserError(error: unknown): error is { type: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { type?: unknown }).type === 'string'
  )
}

/** Convert anything thrown into an AppError; unknown errors become a generic 500. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof ZodError) return validationError(error)
  if (isBodyParserError(error)) {
    if (error.type === 'entity.parse.failed') {
      return new AppError(400, 'invalid_json', 'The request body is not valid JSON.')
    }
    if (error.type === 'entity.too.large') {
      return new AppError(413, 'payload_too_large', 'The request body is too large.')
    }
  }
  return new AppError(500, 'internal_error', 'Something went wrong on our side. Please try again.')
}
