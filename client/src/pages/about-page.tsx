import { Link } from 'react-router'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'

const principles = [
  {
    title: 'Honest by default',
    body: 'We show sources, mark AI-generated content, label what is still in development and never invent numbers to look bigger than we are.',
  },
  {
    title: 'People and AI together',
    body: 'AI is good at explaining and organising. People are good at judgement and experience. EverGuide uses each for what it does best.',
  },
  {
    title: 'Your data is yours',
    body: 'We collect only what is needed to personalise guidance, keep private documents private, and let you delete your data.',
  },
  {
    title: 'Know the limits',
    body: 'Guidance is not diagnosis or regulated advice. When a situation needs a professional, we say so and help you find one.',
  },
]

export default function AboutPage() {
  usePageTitle('About')

  return (
    <>
      <PageHeader
        eyebrow="About EverGuide"
        title="Good guidance shouldn’t depend on who you happen to know."
        lead="Many of the most important decisions — what to study, which job to take, how to handle pressure, what to do with a first salary — are made with little support. EverGuide brings trustworthy information, practical tools and experienced people together so that anyone can make those decisions with more confidence."
      />

      <div className="container-page py-16 sm:py-20">
        <section aria-labelledby="principles-title">
          <h2 id="principles-title" className="text-2xl font-semibold text-ink sm:text-3xl">
            What we hold ourselves to
          </h2>
          <dl className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {principles.map((principle, index) => (
              <div key={principle.title} className="border-t-2 border-ink pt-5">
                <dt className="flex items-baseline gap-3">
                  <span className="font-display text-sm font-semibold text-accent-text">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-lg font-semibold text-ink">{principle.title}</span>
                </dt>
                <dd className="mt-2 leading-relaxed text-muted-foreground">{principle.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-20 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link to="/register">Start your journey</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/contact">Get in touch</Link>
          </Button>
        </div>
      </div>
    </>
  )
}
