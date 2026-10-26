import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import { RedirectIfSignedIn, RequireAuth, RequireOnboarding } from '@/auth/guards'
import { RequireRole } from '@/auth/require-role'
import { AuthLayout } from '@/components/layout/auth-layout'
import { PublicLayout } from '@/components/layout/public-layout'
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
          { path: 'mentors/:mentorId', lazy: page(() => import('@/pages/mentor-detail-page')) },
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
                // The signed-in shell (sidebar, notifications) isn't needed on public pages.
                lazy: async () => ({
                  Component: (await import('@/components/layout/app-layout')).AppLayout,
                }),
                children: [
                  { index: true, lazy: page(() => import('@/pages/app/dashboard-page')) },
                  { path: 'settings', lazy: page(() => import('@/pages/app/settings-page')) },
                  {
                    path: 'mentors',
                    lazy: page(() => import('@/pages/mentors/mentors-layout')),
                    children: [
                      { index: true, lazy: page(() => import('@/pages/mentors/find-mentor-page')) },
                      {
                        path: 'sessions',
                        lazy: page(() => import('@/pages/mentors/sessions-page')),
                      },
                      {
                        path: 'profile',
                        lazy: page(() => import('@/pages/mentors/mentor-profile-page')),
                      },
                      {
                        path: ':mentorId',
                        lazy: page(() => import('@/pages/mentors/app-mentor-detail-page')),
                      },
                    ],
                  },
                  {
                    path: 'wellness',
                    lazy: page(() => import('@/pages/wellness/wellness-layout')),
                    children: [
                      { index: true, lazy: page(() => import('@/pages/wellness/breathing-page')) },
                      {
                        path: 'journal',
                        lazy: page(() => import('@/pages/wellness/journal-page')),
                      },
                      { path: 'habits', lazy: page(() => import('@/pages/wellness/habits-page')) },
                      {
                        path: 'support',
                        lazy: page(() => import('@/pages/wellness/support-page')),
                      },
                    ],
                  },
                  {
                    path: 'finance',
                    lazy: page(() => import('@/pages/finance/finance-layout')),
                    children: [
                      { index: true, lazy: page(() => import('@/pages/finance/budget-page')) },
                      { path: 'savings', lazy: page(() => import('@/pages/finance/savings-page')) },
                      {
                        path: 'calculators',
                        lazy: page(() => import('@/pages/finance/calculators-page')),
                      },
                      {
                        path: 'glossary',
                        lazy: page(() => import('@/pages/finance/glossary-page')),
                      },
                    ],
                  },
                  {
                    path: 'admin',
                    element: <RequireRole role="admin" />,
                    children: [
                      {
                        path: 'mentors',
                        lazy: page(() => import('@/pages/admin/mentor-applications-page')),
                      },
                    ],
                  },
                  {
                    path: 'career',
                    lazy: page(() => import('@/pages/career/career-layout')),
                    children: [
                      { index: true, lazy: page(() => import('@/pages/career/roadmap-page')) },
                      {
                        path: 'resume',
                        lazy: page(() => import('@/pages/career/resume-page')),
                      },
                      {
                        path: 'resume/:resumeId',
                        lazy: page(() => import('@/pages/career/resume-detail-page')),
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
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]
