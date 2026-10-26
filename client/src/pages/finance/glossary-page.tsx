import { Search } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { GLOSSARY_LABEL, glossary } from '@/config/finance'
import { usePageTitle } from '@/hooks/use-page-title'

export default function GlossaryPage() {
  usePageTitle('Money glossary')
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const terms = glossary.filter(
    (t) => !q || t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs text-muted-foreground">{GLOSSARY_LABEL}</p>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search the glossary"
            placeholder="Search terms"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {terms.length === 0 ? (
        <p className="text-muted-foreground">No terms match “{search}”.</p>
      ) : (
        <dl className="divide-y divide-border rounded-lg border border-border bg-surface">
          {terms.map((t) => (
            <div key={t.term} className="p-4">
              <dt className="font-semibold text-ink">{t.term}</dt>
              <dd className="mt-1 leading-relaxed text-foreground">{t.definition}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
