import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/app/admin/mentors', label: 'Mentor applications' },
  { to: '/app/admin/resources', label: 'Resources' },
]

/** Admin area. Only a convenience for admins: the server checks the role on every call. */
export default function AdminLayout() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Administration</h1>
      <nav aria-label="Admin" className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                isActive
                  ? 'border-primary text-blue-700'
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
