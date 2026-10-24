import type { ApiErrorBody } from '@everguide/shared'
import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError, toAppError } from '../lib/errors.ts'

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'not_found', `No endpoint for ${req.method} ${req.path}.`))
}

/**
 * The single place where errors become HTTP responses. Clients always receive the same
 * JSON shape with a request ID; internal details and stack traces never leave the server.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error)

  const appError = toAppError(error)
  // pino-http logs the response; attaching the original error adds its stack to that log line.
  if (appError.status >= 500) res.err = error instanceof Error ? error : new Error(String(error))

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(req.id !== undefined && { requestId: String(req.id) }),
      ...(appError.details && { details: appError.details }),
    },
  }
  res.status(appError.status).json(body)
}
