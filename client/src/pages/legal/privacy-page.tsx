import { Link } from 'react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { LegalPage } from './legal-page'

export default function PrivacyPage() {
  usePageTitle('Privacy Policy')

  return (
    <LegalPage title="Privacy Policy">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            Account details: your name, email address and password (stored by our authentication
            provider in hashed form).
          </li>
          <li>
            Onboarding answers: life stage, goals, interests, preferred guidance areas and skill
            level.
          </li>
          <li>
            Content you create: goals, conversations with the AI Guide, journal entries, uploaded
            resumes and booking details.
          </li>
          <li>
            Usage information needed to run the service, such as AI usage counts against your plan.
          </li>
        </ul>
      </section>
      <section>
        <h2>Why we collect it</h2>
        <p>
          To provide and personalise guidance, run your account, enforce plan limits, keep the
          service secure and, where you agree, send you reminders and updates. We do not sell your
          personal data.
        </p>
      </section>
      <section>
        <h2>Private documents and conversations</h2>
        <p>
          Resumes and journal entries are stored privately and are only accessible to your account.
          AI Guide conversations are processed by our AI provider to generate answers. We minimise
          what is logged and do not use your conversations to advertise to you.
        </p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>
          We rely on providers for hosting, database and authentication, AI processing, payments,
          media delivery and email automation. They process data only to provide those services to
          EverGuide. Payment card details are handled by the payment provider and never stored by
          EverGuide.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Edit your profile and preferences at any time.</li>
          <li>Delete individual conversations, documents and journal entries.</li>
          <li>Request deletion of your account and associated data.</li>
        </ul>
        <p>
          For privacy requests, use the{' '}
          <Link to="/contact?topic=privacy" className="text-primary underline">
            contact form
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  )
}
