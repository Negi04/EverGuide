import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

describe('routing', () => {
  it('renders the landing page hero with both calls to action', async () => {
    renderRoute('/')
    expect(
      await screen.findByRole('heading', { level: 1, name: /your next chapter/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /start your journey/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /explore everguide/i })).toHaveAttribute(
      'href',
      '/features',
    )
  })

  it.each([
    ['/features', /what everguide does/i],
    ['/pricing', /simple plans/i],
    ['/mentors', /learn from people/i],
    ['/resources', /reading and video/i],
    ['/about', /good guidance/i],
    ['/contact', /talk to the everguide team/i],
    ['/privacy', /privacy policy/i],
    ['/terms', /terms of service/i],
    ['/login', /welcome back/i],
    ['/register', /start your journey/i],
  ])('lazy-loads %s', async (path, heading) => {
    renderRoute(path)
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('shows the 404 page for unknown URLs', async () => {
    renderRoute('/does-not-exist')
    expect(
      await screen.findByRole('heading', { name: /took a different path/i }),
    ).toBeInTheDocument()
  })

  it('shows an honest placeholder for workspace modules that are not built yet', async () => {
    setSession(fakeSession())
    renderRoute('/app/wellness')
    expect(
      await screen.findByRole('heading', { level: 1, name: /wellness is on the way/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/build phase 5/i)).toBeInTheDocument()
  })
})
