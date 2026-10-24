import type { ReactNode } from 'react'
import { Notice } from '@/components/common/notice'
import { siteConfig } from '@/config/site'

type LegalPageProps = {
  title: string
  children: ReactNode
}

/** Shared frame for Privacy and Terms: draft banner, readable measure, configured entity details. */
export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <article className="container-page py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold text-ink sm:text-5xl">{title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Last updated: {siteConfig.legal.lastUpdated ?? 'not yet published'}
        </p>
        <Notice className="mt-8">
          This is a working draft that describes how EverGuide is designed to handle data and
          accounts. It will be reviewed by qualified legal counsel and completed with the operating
          entity’s details before launch.
        </Notice>
        <div className="mt-10 space-y-8 leading-relaxed text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:text-muted-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground">
          {children}
        </div>
        <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          Operator: {siteConfig.legal.entityName ?? '[Legal entity name — to be configured]'}
          <br />
          Address: {siteConfig.legal.registeredAddress ?? '[Registered address — to be configured]'}
        </p>
      </div>
    </article>
  )
}
