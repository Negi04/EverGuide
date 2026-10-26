import { LifeBuoy, Phone, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { DRAFT_LABEL, supportGuides } from '@/config/wellness'
import { usePageTitle } from '@/hooks/use-page-title'

export default function SupportPage() {
  usePageTitle('Support')
  return (
    <div className="space-y-10">
      <section
        aria-labelledby="help-now-title"
        className="rounded-lg border border-danger/30 bg-surface p-6"
      >
        <h2 id="help-now-title" className="flex items-center gap-2 text-lg font-semibold text-ink">
          <LifeBuoy className="size-5 text-danger" aria-hidden /> If you need help now
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed">
          <li className="flex gap-2">
            <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>In immediate danger:</strong> call <strong>112</strong> (India’s emergency
              number) or your local emergency number.
            </span>
          </li>
          <li className="flex gap-2">
            <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>Tele-MANAS (India):</strong> call <strong>14416</strong> for free,
              confidential mental-health support, 24/7.
            </span>
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          EverGuide is a guidance tool, not a counselling or crisis service. Talking to someone you
          trust can help too.
        </p>
      </section>

      <section aria-labelledby="guides-title" className="space-y-4">
        <div>
          <h2 id="guides-title" className="text-lg font-semibold text-ink">
            Looking after yourself
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{DRAFT_LABEL}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {supportGuides.map((guide) => (
            <article key={guide.title} className="rounded-lg border border-border bg-surface p-5">
              <h3 className="font-semibold text-ink">{guide.title}</h3>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                {guide.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-muted p-5">
        <p className="flex-1 text-sm">
          Have a question about stress, sleep or wellbeing? The AI Guide answers from EverGuide’s
          guides and shows which guide each answer comes from.
        </p>
        <Button asChild variant="outline">
          <Link to="/app/guide">
            <Sparkles className="size-4" aria-hidden /> Ask the AI Guide
          </Link>
        </Button>
      </div>
    </div>
  )
}
