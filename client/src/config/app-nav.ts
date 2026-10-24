import type { LucideIcon } from 'lucide-react'
import { Compass, HeartPulse, LayoutDashboard, PiggyBank, Settings, Sparkles, UsersRound } from 'lucide-react'

export type AppNavItem = {
  label: string
  to: string
  icon: LucideIcon
  /** Build phase in which the module ships; shown on its placeholder page. */
  phase?: number
  description?: string
}

export const appNav: AppNavItem[] = [
  { label: 'Dashboard', to: '/app', icon: LayoutDashboard },
  {
    label: 'AI Guide',
    to: '/app/guide',
    icon: Sparkles,
    phase: 3,
    description: 'Ask questions and get answers grounded in cited sources.',
  },
  {
    label: 'Career Studio',
    to: '/app/career',
    icon: Compass,
    phase: 4,
    description: 'Build a roadmap, analyse your resume and practise interviews.',
  },
  {
    label: 'Mentors',
    to: '/app/mentors',
    icon: UsersRound,
    phase: 4,
    description: 'Find verified mentors and manage your sessions.',
  },
  {
    label: 'Wellness',
    to: '/app/wellness',
    icon: HeartPulse,
    phase: 5,
    description: 'Breathing exercises, journaling and habit tracking.',
  },
  {
    label: 'Finance',
    to: '/app/finance',
    icon: PiggyBank,
    phase: 5,
    description: 'Budgets, savings goals and educational calculators.',
  },
  {
    label: 'Settings',
    to: '/app/settings',
    icon: Settings,
    phase: 2,
    description: 'Profile, preferences and account settings.',
  },
]
