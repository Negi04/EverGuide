import { BookOpen, Briefcase, HeartPulse, PiggyBank, Presentation, Sprout } from 'lucide-react'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { usePageTitle } from '@/hooks/use-page-title'

const collections = [
  {
    icon: Briefcase,
    name: 'Careers & education',
    body: 'Choosing a path, switching fields, building skills and portfolios.',
  },
  {
    icon: Presentation,
    name: 'Interview preparation',
    body: 'Technical and behavioural practice, and how to talk about your work.',
  },
  {
    icon: HeartPulse,
    name: 'Mental & physical wellness',
    body: 'Managing stress, sleep, movement and knowing when to seek help.',
  },
  {
    icon: PiggyBank,
    name: 'Financial literacy',
    body: 'Budgeting, saving, borrowing and the vocabulary behind them.',
  },
  {
    icon: Sprout,
    name: 'Personal development',
    body: 'Habits, communication, focus and confidence.',
  },
]

export default function ResourcesPage() {
  usePageTitle('Resource library')

  return (
    <>
      <PageHeader
        eyebrow="Resource library"
        title="Reading and video, chosen with care."
        lead="Every article and video in the library is reviewed before it is published. The same reviewed material also grounds the AI Guide’s answers."
      />

      <div className="container-page space-y-16 py-16 sm:py-20">
        <EmptyState icon={BookOpen} title="The library is being curated">
          <p>
            The first collections are in review. Articles and videos will appear here once they are
            published — there is nothing to browse yet.
          </p>
        </EmptyState>

        <section aria-labelledby="collections-title">
          <h2 id="collections-title" className="text-2xl font-semibold text-ink sm:text-3xl">
            Planned collections
          </h2>
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {collections.map(({ icon: Icon, name, body }) => (
              <li key={name} className="flex gap-4 py-5">
                <Icon className="mt-0.5 size-5 shrink-0 text-blue-600" aria-hidden />
                <div>
                  <h3 className="font-semibold text-ink">{name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
