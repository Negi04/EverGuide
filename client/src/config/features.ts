import type { LucideIcon } from 'lucide-react'
import { BookOpen, Compass, HeartPulse, PiggyBank, Sparkles, UsersRound } from 'lucide-react'

/**
 * Honest availability for every product area. Update the status here as phases ship;
 * the landing and features pages read from this list.
 */
export type FeatureStatus = 'available' | 'in-development' | 'planned'

export const featureStatusLabel: Record<FeatureStatus, string> = {
  available: 'Available',
  'in-development': 'In development',
  planned: 'Planned',
}

export type Domain = {
  id: string
  name: string
  icon: LucideIcon
  summary: string
  description: string
  capabilities: { label: string; status: FeatureStatus }[]
}

export const domains: Domain[] = [
  {
    id: 'ai-guide',
    name: 'AI Guide',
    icon: Sparkles,
    summary: 'Answers grounded in EverGuide’s curated guides, with citations you can open.',
    description:
      'Ask about careers, interviews, wellbeing or money. EverGuide retrieves passages from a curated knowledge base, answers from that evidence, and tells you when the evidence is not enough.',
    capabilities: [
      { label: 'Conversations with history and search', status: 'available' },
      { label: 'Citations linked to retrieved sources', status: 'available' },
      {
        label: 'Domain modes: career, interview, wellness, finance, growth',
        status: 'available',
      },
      { label: 'Feedback on every answer', status: 'available' },
    ],
  },
  {
    id: 'career',
    name: 'Career Studio',
    icon: Compass,
    summary: 'Roadmaps, resume analysis and interview practice built around your goal.',
    description:
      'Turn a target role into goals and milestones with dates. Compare your resume against a job description and practise technical and behavioural questions.',
    capabilities: [
      { label: 'Goal and milestone roadmap', status: 'available' },
      { label: 'Private resume analysis against a job description', status: 'available' },
      { label: 'Role-based interview practice', status: 'available' },
    ],
  },
  {
    id: 'mentors',
    name: 'Mentorship',
    icon: UsersRound,
    summary: 'Book time with mentors whose background has been reviewed.',
    description:
      'Mentors apply, and their experience is reviewed before they are marked Verified. Find someone by expertise and availability, request a session, and leave a review after it happens.',
    capabilities: [
      { label: 'Search by expertise, role or company', status: 'available' },
      { label: 'Reviewed verification status', status: 'available' },
      { label: 'Booking, rescheduling and cancellation', status: 'available' },
    ],
  },
  {
    id: 'wellness',
    name: 'Wellness',
    icon: HeartPulse,
    summary: 'Supportive everyday tools — not diagnosis.',
    description:
      'Guided breathing, a private journal, habit tracking and clear routes to professional support when you need more than a tool can offer.',
    capabilities: [
      { label: 'Guided breathing', status: 'available' },
      { label: 'Private journal and habit tracker', status: 'available' },
      { label: 'Helplines and self-care guidance', status: 'available' },
    ],
  },
  {
    id: 'finance',
    name: 'Financial literacy',
    icon: PiggyBank,
    summary: 'Understand budgets, savings and the terms behind them.',
    description:
      'Plan a budget, set savings goals and use calculators to see how choices compound. Everything here is general education, not personal financial advice.',
    capabilities: [
      { label: 'Budget planner and savings goals', status: 'available' },
      { label: 'Educational calculators', status: 'available' },
      { label: 'Plain-language glossary', status: 'available' },
    ],
  },
  {
    id: 'resources',
    name: 'Resource library',
    icon: BookOpen,
    summary: 'Articles and videos selected for each stage of growth.',
    description:
      'Articles and videos chosen by the EverGuide team. Recommendations based on your roadmap are planned.',
    capabilities: [
      { label: 'Curated articles and videos', status: 'in-development' },
      { label: 'Recommendations from your roadmap', status: 'planned' },
    ],
  },
]
