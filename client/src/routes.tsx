import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import { AppLayout } from '@/components/layout/app-layout'
import { AuthLayout } from '@/components/layout/auth-layout'
import { PublicLayout } from '@/components/layout/public-layout'
import { appNav } from '@/config/app-nav'
import LandingPage from '@/pages/landing/landing-page'
import NotFoundPage from '@/pages/not-found-page'
import RouteErrorPage from '@/pages/route-error-page'

/** Lazy-load a page module so each route ships as its own chunk. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
})

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          // The landing page is loaded eagerly because it is the most common entry point.
          { index: true, element: <LandingPage /> },
          { path: 'features', lazy: page(() => import('@/pages/features-page')) },
          { path: 'pricing', lazy: page(() => import('@/pages/pricing-page')) },
          { path: 'mentors', lazy: page(() => import('@/pages/mentors-page')) },
          { path: 'resources', lazy: page(() => import('@/pages/resources-page')) },
          { path: 'about', lazy: page(() => import('@/pages/about-page')) },
          { path: 'contact', lazy: page(() => import('@/pages/contact-page')) },
          { path: 'privacy', lazy: page(() => import('@/pages/legal/privacy-page')) },
          { path: 'terms', lazy: page(() => import('@/pages/legal/terms-page')) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', lazy: page(() => import('@/pages/auth/login-page')) },
          { path: 'register', lazy: page(() => import('@/pages/auth/register-page')) },
        ],
      },
      {
        path: 'app',
        element: <AppLayout />,
        children: [
          { index: true, lazy: page(() => import('@/pages/app/dashboard-page')) },
          ...appNav
            .filter((item) => item.to !== '/app')
            .map((item) => ({
              path: item.to.replace('/app/', ''),
              lazy: page(() => import('@/pages/app/module-placeholder-page')),
            })),
        ],
      },
    ],
  },
]
