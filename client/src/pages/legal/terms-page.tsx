import { usePageTitle } from '@/hooks/use-page-title'
import { LegalPage } from './legal-page'

export default function TermsPage() {
  usePageTitle('Terms of Service')

  return (
    <LegalPage title="Terms of Service">
      <section>
        <h2>Using EverGuide</h2>
        <p>
          EverGuide provides career guidance, educational content, wellness and financial literacy
          tools, an AI assistant and access to independent mentors. You are responsible for keeping
          your account secure and for the information you provide.
        </p>
      </section>
      <section>
        <h2>Guidance, not professional advice</h2>
        <p>
          Content and AI-generated answers are general information for learning and planning. They
          are not medical, mental-health, legal or financial advice, and may contain mistakes. Check
          important information and consult a qualified professional for decisions that need one.
        </p>
      </section>
      <section>
        <h2>Mentors</h2>
        <p>
          Mentors are independent. A Verified badge means EverGuide reviewed the evidence a mentor
          provided; it is not a guarantee of outcomes. Booking, cancellation and review rules are
          shown when you book.
        </p>
      </section>
      <section>
        <h2>Subscriptions</h2>
        <p>
          Paid plans renew until cancelled. Prices and usage allowances are shown before you
          subscribe. Cancelling stops future renewals; access continues until the end of the paid
          period.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>
            Do not misuse the service, attempt to access other users’ data or disrupt the platform.
          </li>
          <li>
            Do not misrepresent your identity or experience, including in mentor applications.
          </li>
          <li>Do not upload content you do not have the right to share.</li>
        </ul>
      </section>
    </LegalPage>
  )
}
