import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import { RedirectIfSignedIn, RequireAuth, RequireOnboarding } from '@/auth/guards'
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

const builtAppPages = new Set(['/app', '/app/settings', '/app/guide', '/app/career'])

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
          { path: 'account-deleted', lazy: page(() => import('@/pages/account-deleted-page')) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          {
            element: <RedirectIfSignedIn />,
            children: [
              { path: 'login', lazy: page(() => import('@/pages/auth/login-page')) },
              { path: 'register', lazy: page(() => import('@/pages/auth/register-page')) },
              {
                path: 'forgot-password',
                lazy: page(() => import('@/pages/auth/forgot-password-page')),
              },
            ],
          },
          { path: 'reset-password', lazy: page(() => import('@/pages/auth/reset-password-page')) },
          { path: 'auth/callback', lazy: page(() => import('@/pages/auth/auth-callback-page')) },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: 'onboarding', lazy: page(() => import('@/pages/onboarding/onboarding-page')) },
          {
            element: <RequireOnboarding />,
            children: [
              {
                path: 'app',
                element: <AppLayout />,
                children: [
                  { index: true, lazy: page(() => import('@/pages/app/dashboard-page')) },
                  { path: 'settings', lazy: page(() => import('@/pages/app/settings-page')) },
                  {
                    path: 'career',
                    lazy: page(() => import('@/pages/career/career-layout')),
                    children: [
                      { index: true, lazy: page(() => import('@/pages/career/roadmap-page')) },
                      {
                        path: 'resume',
                        lazy: page(() => import('@/pages/career/coming-soon-tab')),
                      },
                      {
                        path: 'interview',
                        lazy: page(() => import('@/pages/career/interview-page')),
                      },
                      {
                        path: 'interview/:questionId',
                        lazy: page(() => import('@/pages/career/practice-page')),
                      },
                    ],
                  },
                  {
                    path: 'guide',
                    handle: { fullBleed: true },
                    lazy: page(() => import('@/pages/guide/guide-layout')),
                    children: [
                      {
                        index: true,
                        lazy: page(() => import('@/pages/guide/new-conversation-page')),
                      },
                      {
                        path: ':conversationId',
                        lazy: page(() => import('@/pages/guide/conversation-page')),
                      },
                    ],
                  },
                  ...appNav
                    .filter((item) => !builtAppPages.has(item.to))
                    .map((item) => ({
                      path: item.to.replace('/app/', ''),
                      lazy: page(() => import('@/pages/app/module-placeholder-page')),
                    })),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]
