import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow: string
  title: string
  lead?: ReactNode
  children?: ReactNode
}

/** Title band at the top of inner public pages. */
export function PageHeader({ eyebrow, title, lead, children }: PageHeaderProps) {
  return (
    <section className="border-b border-border bg-surface">
      <div className="container-page py-16 sm:py-20">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold text-ink sm:text-5xl">{title}</h1>
        {lead && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{lead}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  )
}
