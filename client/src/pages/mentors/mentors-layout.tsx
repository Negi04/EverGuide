import { NavLink, Outlet } from 'react-router'
import { useMyMentorProfile } from '@/hooks/use-mentors'
import { cn } from '@/lib/utils'

export default function MentorsLayout() {
  const ownProfile = useMyMentorProfile()
  const tabs = [
    { to: '/app/mentors', label: 'Find a mentor', end: true },
    { to: '/app/mentors/sessions', label: 'My sessions', end: false },
    {
      to: '/app/mentors/profile',
      // Says where to apply until the person has a mentor profile.
      label: ownProfile.data === null ? 'Become a mentor' : 'Mentor profile',
      end: false,
    },
  ]

  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Mentorship</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Learn from people a few steps ahead</h1>
      <nav
        aria-label="Mentorship"
        className="mt-6 flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap',
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
