import type { LucideIcon } from 'lucide-react'
import {
  Compass,
  HeartPulse,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Sparkles,
  UsersRound,
} from 'lucide-react'

export type AppNavItem = {
  label: string
  to: string
  icon: LucideIcon
}

export const appNav: AppNavItem[] = [
  { label: 'Dashboard', to: '/app', icon: LayoutDashboard },
  { label: 'AI Guide', to: '/app/guide', icon: Sparkles },
  { label: 'Career Studio', to: '/app/career', icon: Compass },
  { label: 'Mentors', to: '/app/mentors', icon: UsersRound },
  { label: 'Wellness', to: '/app/wellness', icon: HeartPulse },
  { label: 'Finance', to: '/app/finance', icon: PiggyBank },
  { label: 'Settings', to: '/app/settings', icon: Settings },
]
