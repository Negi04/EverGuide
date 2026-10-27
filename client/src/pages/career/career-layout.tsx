import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/app/career', label: 'Roadmap', end: true },
  { to: '/app/career/resume', label: 'Resume', end: false },
  { to: '/app/career/interview', label: 'Interview practice', end: false },
]

export default function CareerLayout() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Career Studio</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Plan, prepare and practise</h1>
      <nav
        aria-label="Career Studio"
        className="mt-6 flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                isActive
                  ? 'border-primary text-brand-700'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  )
}
