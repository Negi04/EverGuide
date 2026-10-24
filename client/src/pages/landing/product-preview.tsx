import { FileText, Plus, Search, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'

const exampleThreads = [
  'Moving into data analysis',
  'Preparing for a first interview',
  'Building a monthly budget',
]

/**
 * A static, clearly labelled illustration of the AI Guide workspace.
 * Every piece of content inside is example text, not real user data or real sources.
 */
export function ProductPreview() {
  return (
    <section
      aria-labelledby="preview-title"
      className="border-y border-border bg-surface py-20 sm:py-28"
    >
      <div className="container-page">
        <SectionHeading
          id="preview-title"
          eyebrow="The AI Guide"
          title="Answers that show their work."
          lead="Each answer is built from passages retrieved from EverGuide's reviewed knowledge base. Numbered citations take you to the exact source behind every claim."
        />

        <figure className="mt-14">
          <div className="overflow-hidden rounded-lg border border-border-strong bg-background shadow-lg">
            <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="ml-3 text-xs font-medium text-muted-foreground">
                EverGuide · AI Guide
              </span>
            </div>

            <div className="grid md:grid-cols-[15rem_1fr]">
              <aside className="hidden border-r border-border bg-surface p-4 md:block">
                <div className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                  <Plus className="size-4" aria-hidden /> New conversation
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                  <Search className="size-3.5" aria-hidden /> Search conversations
                </div>
                <ul className="mt-4 space-y-1 text-sm">
                  {exampleThreads.map((thread, index) => (
                    <li
                      key={thread}
                      className={
                        index === 0
                          ? 'rounded-md bg-blue-50 px-3 py-2 font-medium text-blue-700'
                          : 'rounded-md px-3 py-2 text-muted-foreground'
                      }
                    >
                      {thread}
                    </li>
                  ))}
                </ul>
              </aside>

              <div className="space-y-6 p-5 sm:p-8">
                <div className="ml-auto max-w-md rounded-lg rounded-br-sm bg-ink px-4 py-3 text-sm text-ink-foreground">
                  I work in customer support. What should I learn first to move into a data analyst
                  role?
                </div>

                <div className="max-w-2xl">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                    <Sparkles className="size-3.5" aria-hidden /> AI-generated · Career mode
                  </p>
                  <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground">
                    <p>
                      Your support experience is a real asset — you already work with customer
                      problems and ticket data. A common path is to start with spreadsheet analysis
                      and SQL, then add one visualisation tool
                      <Cite n={1} />.
                    </p>
                    <p>
                      Build two or three small projects using data you understand, such as support
                      response times, and write up what you found
                      <Cite n={2} />.
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <SourceChip n={1} title="Example source: Career transitions guide" />
                    <SourceChip n={2} title="Example source: Building a portfolio" />
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-muted-foreground">
                    <ThumbsUp className="size-4" aria-hidden />
                    <ThumbsDown className="size-4" aria-hidden />
                    <span className="text-xs">Was this helpful?</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <figcaption className="mt-4 text-center text-sm text-muted-foreground">
            Interface preview with example content. The AI Guide is in development.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

function Cite({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 inline-flex size-4 items-center justify-center rounded-sm bg-blue-100 text-[0.65rem] font-semibold text-blue-700">
      {n}
    </sup>
  )
}

function SourceChip({ n, title }: { n: number; title: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-muted-foreground">
      <span className="font-semibold text-blue-700">{n}</span>
      <FileText className="size-3.5" aria-hidden />
      {title}
    </span>
  )
}
