import { Link } from 'react-router'
import { Logo } from '@/components/brand/logo'
import { footerNav, siteConfig } from '@/config/site'

// Computed once at load rather than during render, which keeps rendering pure.
const year = new Date().getFullYear()

export function SiteFooter() {
  return (
    <footer className="on-ink bg-ink text-ink-foreground">
      <div className="container-page grid gap-12 py-16 lg:grid-cols-[1.2fr_2fr]">
        <div className="max-w-sm space-y-4">
          <Logo tone="ink" />
          <p className="text-sm leading-relaxed text-ink-muted">{siteConfig.tagline}</p>
          <p className="text-sm text-ink-muted">
            {siteConfig.contact.email ? (
              <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-white">
                {siteConfig.contact.email}
              </a>
            ) : (
              <Link to="/contact" className="underline-offset-4 hover:text-white hover:underline">
                Contact us
              </Link>
            )}
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {footerNav.map((group) => (
            <div key={group.heading}>
              <h2 className="font-sans text-xs font-semibold tracking-[0.14em] text-white uppercase">
                {group.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="text-sm text-ink-muted transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-ink-border">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteConfig.legal.entityName ?? siteConfig.name}. All rights reserved.
          </p>
          <p>
            EverGuide provides general guidance and education. It is not a substitute for licensed
            medical, mental-health or financial advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
