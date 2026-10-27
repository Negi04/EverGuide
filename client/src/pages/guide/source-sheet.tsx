import type { Citation } from '@everguide/shared'
import { ExternalLink, FileText } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'

/** Shows the exact retrieved passage behind a citation. */
export function SourceSheet({
  citation,
  onClose,
}: {
  citation: Citation | null
  onClose: () => void
}) {
  return (
    <Sheet open={citation !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[min(28rem,100%)]">
        {citation && (
          <div className="flex h-full flex-col overflow-y-auto pr-2">
            <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
              Source {citation.number}
            </p>
            <SheetTitle className="mt-2 font-display text-xl font-semibold text-ink">
              {citation.title}
            </SheetTitle>
            <SheetDescription className="mt-1 text-sm text-muted-foreground">
              {citation.sourceName}
            </SheetDescription>

            <h3 className="mt-6 flex items-center gap-2 text-sm font-semibold text-ink">
              <FileText className="size-4 text-brand-600" aria-hidden /> Passage used for this
              answer
            </h3>
            <blockquote className="mt-2 rounded-md border-l-4 border-brand-600 bg-brand-50/60 px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-foreground">
              {citation.excerpt}
            </blockquote>

            <p className="mt-4 text-xs text-muted-foreground">
              Relevance score: {(citation.similarity * 100).toFixed(0)}%
            </p>
            {citation.sourceUrl && (
              <a
                href={citation.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open the original source <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
