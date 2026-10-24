/**
 * Site-wide configuration. Values set to `null` are intentionally unconfigured;
 * the UI shows them as "to be announced" instead of inventing details.
 */
export const siteConfig = {
  name: 'EverGuide',
  tagline: 'Guidance for a Brighter Tomorrow.',
  description:
    'AI-assisted career guidance with cited sources, verified mentorship, wellness and financial literacy — in one place.',
  contact: {
    email: null as string | null,
    supportEmail: null as string | null,
  },
  legal: {
    entityName: null as string | null,
    registeredAddress: null as string | null,
    lastUpdated: null as string | null,
  },
} as const

export type NavItem = { label: string; to: string }

export const primaryNav: NavItem[] = [
  { label: 'Features', to: '/features' },
  { label: 'Mentors', to: '/mentors' },
  { label: 'Resources', to: '/resources' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'About', to: '/about' },
]

export const footerNav: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Product',
    items: [
      { label: 'Features', to: '/features' },
      { label: 'AI Guide', to: '/features#ai-guide' },
      { label: 'Mentors', to: '/mentors' },
      { label: 'Pricing', to: '/pricing' },
    ],
  },
  {
    heading: 'Learn',
    items: [
      { label: 'Resource library', to: '/resources' },
      { label: 'Wellness', to: '/features#wellness' },
      { label: 'Financial literacy', to: '/features#finance' },
    ],
  },
  {
    heading: 'Company',
    items: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Become a mentor', to: '/contact?topic=mentorship' },
    ],
  },
  {
    heading: 'Legal',
    items: [
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' },
    ],
  },
]
