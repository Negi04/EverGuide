/** Every API error response has this shape, so the client can handle errors uniformly. */
export type ApiErrorCode =
  | 'validation_failed'
  | 'invalid_json'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'payload_too_large'
  | 'rate_limited'
  | 'service_unavailable'
  | 'internal_error'

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode
    message: string
    requestId?: string
    details?: { path: string; message: string }[]
  }
}
