import { SectionHeading } from '@/components/common/section-heading'
import { Reveal } from '@/components/motion/reveal'

const steps = [
  {
    title: 'Tell us where you are',
    body: 'A short onboarding asks about your stage of life, goals and interests. Only what is needed to personalise your guidance.',
  },
  {
    title: 'Get a plan you can follow',
    body: 'Turn a goal into milestones with dates, ask the AI Guide questions along the way, and see recommended resources for each step.',
  },
  {
    title: 'Grow with people and tools',
    body: 'Book sessions with verified mentors, keep your wellbeing in check, and build money skills as your plans change.',
  },
]

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="From uncertainty to a next step."
        />

        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 120} className="relative">
              <div className="flex items-center gap-4">
                <span className="font-display text-5xl leading-none font-semibold bg-gradient-to-b from-blue-600 to-sky-400 bg-clip-text text-transparent">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {index < steps.length - 1 && (
                  <span className="hidden h-px flex-1 bg-border-strong md:block" aria-hidden />
                )}
              </div>
              <h3 className="mt-5 text-xl font-semibold text-ink">{step.title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
