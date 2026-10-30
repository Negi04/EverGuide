import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'

/**
 * Content Security Policy for the production build: the browser refuses any
 * script, frame or connection not listed here, so injected code (XSS) can't load
 * scripts from elsewhere or send data to other sites.
 *
 * It is added as a <meta> tag so it travels with the static files. A host can
 * send the same policy as a header later and add what a meta tag can't express
 * (frame-ancestors, to stop other sites framing EverGuide).
 *
 * Not used by the dev server: Vite's hot reload needs inline scripts and websockets.
 */
export function contentSecurityPolicy(origins: { api: string; supabase: string }): Plugin {
  return {
    name: 'everguide-csp',
    apply: 'build',
    transformIndexHtml(html) {
      // The inline theme script is allowed by its exact hash: any other inline script is not.
      const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
        ([, code]) => `'sha256-${createHash('sha256').update(code!).digest('base64')}'`,
      )
      const supabase = new URL(origins.supabase).origin
      const policy = {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          ...hashes,
          'https://checkout.razorpay.com',
          'https://cdn.razorpay.com',
        ],
        // Inline style attributes are used by React components (progress bars, positions).
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          'https://res.cloudinary.com',
          'https://*.razorpay.com',
        ],
        'font-src': ["'self'"],
        'connect-src': [
          "'self'",
          new URL(origins.api).origin,
          supabase,
          'https://api.cloudinary.com',
          'https://api.razorpay.com',
          'https://lumberjack.razorpay.com',
        ],
        'frame-src': [
          'https://www.youtube-nocookie.com',
          'https://api.razorpay.com',
          'https://checkout.razorpay.com',
        ],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
      }
      const content = Object.entries(policy)
        .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
        .join('; ')
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}
