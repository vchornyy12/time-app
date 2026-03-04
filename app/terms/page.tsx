import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Terms of Service — time24',
  description: 'Terms of Service for time24, a GTD-based task management application.',
}

const EFFECTIVE_DATE = 'March 4, 2026'
const CONTACT_EMAIL = 'vchornyy12@gmail.com'
const APP_NAME = 'time24'

export default function TermsPage() {
  return (
    <div
      className="min-h-screen bg-[#181818] text-zinc-100"
      style={{ '--text-primary': '#f4f4f5' } as React.CSSProperties}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#181818] border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <Logo size="md" />
          </Link>
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#3ECF8E] mb-3">
            Legal
          </p>
          <h1 className="text-4xl font-bold text-zinc-100 mb-3">Terms of Service</h1>
          <p className="text-sm text-zinc-500">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div className="flex flex-col gap-10 text-zinc-300 leading-relaxed">

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using {APP_NAME} (the &ldquo;Service&rdquo;), you agree to be bound
              by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the
              Service. These Terms apply to all visitors, registered users, and anyone else who
              accesses the Service.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              {APP_NAME} is a personal task management application built around the Getting Things
              Done (GTD) methodology. It allows you to capture, process, and organise tasks,
              projects, and notes, with an optional integration with Google Calendar.
            </p>
          </Section>

          <Section title="3. Eligibility">
            <p>
              You must be at least 13 years old to use the Service. By using the Service, you
              represent that you meet this requirement and that the information you provide is
              accurate and complete.
            </p>
          </Section>

          <Section title="4. User Accounts">
            <ul className="list-disc list-inside flex flex-col gap-1.5 text-zinc-400">
              <li>
                You are responsible for maintaining the confidentiality of your account credentials.
              </li>
              <li>
                You are responsible for all activity that occurs under your account.
              </li>
              <li>
                You must notify us immediately at{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#3ECF8E] hover:underline">
                  {CONTACT_EMAIL}
                </a>{' '}
                if you suspect unauthorised access to your account.
              </li>
              <li>
                We reserve the right to suspend or terminate accounts that violate these Terms.
              </li>
            </ul>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc list-inside mt-2 flex flex-col gap-1.5 text-zinc-400">
              <li>Violate any applicable law or regulation.</li>
              <li>Attempt to gain unauthorised access to other users&apos; data or our systems.</li>
              <li>Upload or transmit malicious code, viruses, or any software intended to harm.</li>
              <li>Scrape, crawl, or data-mine the Service without our written consent.</li>
              <li>
                Resell, sublicense, or exploit the Service or any part of it for commercial purposes
                without a separate written agreement.
              </li>
              <li>Impersonate any person or entity.</li>
            </ul>
          </Section>

          <Section title="6. User Content">
            <p>
              You retain ownership of all tasks, notes, and other content you create in the Service
              (&ldquo;User Content&rdquo;). By using the Service, you grant us a limited,
              non-exclusive licence to store and process your User Content solely as necessary to
              provide the Service to you.
            </p>
            <p>
              You are solely responsible for the legality and appropriateness of your User Content.
              We do not review User Content and have no obligation to do so.
            </p>
          </Section>

          <Section title="7. Third-Party Integrations">
            <p>
              The Service may integrate with third-party services such as Google Calendar. Your
              use of those integrations is additionally governed by the respective third party&apos;s
              terms of service and privacy policies. We are not responsible for the availability,
              accuracy, or acts of third-party services.
            </p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              All rights, title, and interest in and to the Service (excluding User Content),
              including its software, design, and documentation, are and remain the exclusive
              property of {APP_NAME} and its licensors. These Terms do not grant you any right
              to use our trademarks, logos, or brand features.
            </p>
          </Section>

          <Section title='9. Disclaimer of Warranties — "As-Is" Software'>
            <p>
              THE SERVICE IS PROVIDED <strong className="text-zinc-100">&ldquo;AS IS&rdquo;</strong>{' '}
              AND{' '}
              <strong className="text-zinc-100">&ldquo;AS AVAILABLE&rdquo;</strong> WITHOUT
              WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
              NON-INFRINGEMENT.
            </p>
            <p>
              We do not warrant that the Service will be uninterrupted, error-free, or free of
              harmful components, or that any defects will be corrected. You use the Service at
              your own risk. We strongly recommend maintaining your own backups of critical data.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, {APP_NAME.toUpperCase()} AND ITS
              OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA,
              PROFITS, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY
              TO USE THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p>
              OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE SHALL NOT
              EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE
              CLAIM, OR (B) USD $10.
            </p>
          </Section>

          <Section title="11. Termination">
            <p>
              You may stop using the Service and delete your account at any time from the Settings
              page. Upon deletion, your data is permanently removed from our systems (subject to
              retention required by law or legitimate business needs not exceeding 30 days).
            </p>
            <p>
              We may suspend or terminate your access to the Service at any time, with or without
              notice, if we reasonably believe you have violated these Terms. Sections 8, 9, 10,
              and 12 survive termination.
            </p>
          </Section>

          <Section title="12. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              jurisdiction in which {APP_NAME} is established, without regard to its conflict of
              law provisions. Any disputes shall be resolved in the competent courts of that
              jurisdiction.
            </p>
          </Section>

          <Section title="13. Changes to These Terms">
            <p>
              We may update these Terms from time to time. We will notify registered users by email
              and update the effective date above at least 14 days before material changes take
              effect. Continued use of the Service after the effective date constitutes acceptance
              of the revised Terms.
            </p>
          </Section>

          <Section title="14. Contact">
            <p>
              Questions about these Terms? Contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#3ECF8E] hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-white/10 flex items-center justify-between">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
            ← Back to Home
          </Link>
          <Link href="/privacy" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
            Privacy Policy →
          </Link>
        </div>
      </main>
    </div>
  )
}

// ─── Layout helper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}
