import { ArrowRight, FileSearch, MessageSquareQuote, ShieldAlert, TextSearch } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'

const pipeline = [
  {
    icon: TextSearch,
    title: 'Retrieve',
    body: 'Your question is matched against a curated, reviewed knowledge base — not the open web.',
  },
  {
    icon: FileSearch,
    title: 'Check the evidence',
    body: 'Only passages that are relevant enough are kept. If none are, the guide says so.',
  },
  {
    icon: MessageSquareQuote,
    title: 'Answer with citations',
    body: 'The answer is written from that evidence, and every citation points to a passage that was actually retrieved.',
  },
]

export function GroundedAiSection() {
  return (
    <section aria-labelledby="grounded-title" className="on-ink bg-ink py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          id="grounded-title"
          tone="ink"
          eyebrow="Source-grounded AI"
          title="Advice you can check, not just trust."
          lead="General-purpose chatbots can sound confident while being wrong. EverGuide grounds each answer in reviewed sources and is open about what it does not know."
        />

        <ol className="mt-14 grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {pipeline.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="contents">
              <div className="rounded-lg border border-ink-border bg-navy-800/60 p-6">
                <Icon className="size-6 text-sky-400" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              </div>
              {index < pipeline.length - 1 && (
                <ArrowRight
                  className="mx-auto hidden size-5 self-center text-gold-400 lg:block"
                  aria-hidden
                />
              )}
            </li>
          ))}
        </ol>

        <div className="mt-10 flex gap-4 rounded-lg border border-gold-400/30 bg-gold-400/5 p-5 sm:p-6">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-gold-400" aria-hidden />
          <p className="text-sm leading-relaxed text-ink-foreground">
            The AI Guide is a learning and planning companion. It is not a doctor, therapist or
            financial adviser, and it will point you to professional and crisis support when a
            conversation needs it.
          </p>
        </div>
      </div>
    </section>
  )
}
