import { isAuthError } from '@supabase/auth-js'

/** Turn Supabase Auth errors into messages people can act on. */
export function authErrorMessage(error: unknown): string {
  if (!isAuthError(error)) return 'Something went wrong. Please try again.'
  switch (error.code) {
    case 'invalid_credentials':
      return 'That email and password don’t match an account.'
    case 'email_not_confirmed':
      return 'Please confirm your email address first. Check your inbox for the link.'
    case 'weak_password':
      return 'That password is too easy to guess. Please choose a stronger one.'
    case 'same_password':
      return 'Your new password must be different from your current one.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts. Please wait a few minutes and try again.'
    case 'signup_disabled':
      return 'New registrations are paused right now.'
    case 'email_address_invalid':
      return 'Please use a different email address.'
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Try logging in instead.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
