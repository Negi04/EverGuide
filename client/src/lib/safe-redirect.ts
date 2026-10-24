/**
 * Only allow redirects to paths on this site. Without this, a link like
 * /login?redirect=https://evil.example could send users to a phishing page after login.
 */
export function safeRedirect(target: string | null | undefined, fallback = '/app'): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return fallback
  }
  return target
}
