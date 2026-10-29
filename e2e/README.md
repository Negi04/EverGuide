# Browser tests (Playwright)

End-to-end tests drive the real website in Google Chrome against the real API and the
Supabase project in `.env`. Each test creates its own throwaway accounts and deletes
them afterwards.

```
npm run test:e2e                 # everything (starts the API and website if needed)
npx playwright test mentors      # one file, from the e2e folder
npx playwright show-report       # the HTML report, with traces of failures
```

| File                         | What it checks                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `public-site.spec.ts`        | every public page loads on a phone without errors or sideways scrolling; the theme script runs |
| `auth.spec.ts`               | sign-in redirects, wrong password, sign-out, admin pages closed to non-admins                  |
| `mentors.spec.ts`            | apply → admin verifies → set hours → book → confirm → join link                                |
| `wellness-finance.spec.ts`   | journal, habit streak, budget amounts exact to the paisa                                       |
| `billing-automation.spec.ts` | demo billing page; a sign-up appears in Admin → Automation                                     |
| `accessibility.spec.ts`      | axe (WCAG 2.1 A/AA) and a measured contrast check on 32 pages, in both themes                  |

**Opening real Razorpay Checkout:** set `E2E_RAZORPAY=1`. It's off by default because it
creates a Test Mode order and depends on Razorpay being reachable.

**Testing the production build** (with its Content Security Policy):

```
npm run build
cd client && npx vite preview --port 5173 --strictPort   # instead of the dev server
npm run test:e2e
```

Any resource the policy blocks shows up as a console error, which fails the tests.
