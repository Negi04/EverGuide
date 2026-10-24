import { useEffect } from 'react'
import { siteConfig } from '@/config/site'

/** Sets document.title as "<page> · EverGuide", or the brand default when no page title is given. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title
      ? `${title} · ${siteConfig.name}`
      : `${siteConfig.name} — ${siteConfig.tagline.replace(/\.$/, '')}`
  }, [title])
}
