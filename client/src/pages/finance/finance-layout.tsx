import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/app/finance', label: 'Budget', end: true },
  { to: '/app/finance/savings', label: 'Savings goals', end: false },
  { to: '/app/finance/calculators', label: 'Calculators', end: false },
  { to: '/app/finance/glossary', label: 'Glossary', end: false },
]

export default function FinanceLayout() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Finance</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Plan your money with confidence</h1>
      <nav aria-label="Finance" className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
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
