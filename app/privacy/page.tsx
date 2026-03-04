import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Privacy Policy — time24',
  description: 'Privacy Policy for time24, a GTD-based task management application.',
}

const EFFECTIVE_DATE = 'March 4, 2026'
const CONTACT_EMAIL = 'vchornyy12@gmail.com'
const APP_NAME = 'time24'

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold text-zinc-100 mb-3">Privacy Policy</h1>
          <p className="text-sm text-zinc-500">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div className="flex flex-col gap-10 text-zinc-300 leading-relaxed">

          <Section title="1. Introduction">
            <p>
              {APP_NAME} (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates a
              Getting Things Done (GTD) task management application (the &ldquo;Service&rdquo;).
              This Privacy Policy explains what information we collect, how we use it, and the
              choices you have. By using the Service you agree to the practices described here.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <Subsection title="2.1 Account information">
              <p>
                When you register, we collect your email address and an encrypted password (or, if
                you sign in with Google, only a Google-issued identifier — we never see your Google
                password).
              </p>
            </Subsection>
            <Subsection title="2.2 Task and project data">
              <p>
                All tasks, projects, notes, and preferences you create are stored in our database,
                isolated to your account via Supabase Row Level Security (RLS) policies.
              </p>
            </Subsection>
            <Subsection title="2.3 Google Calendar data">
              <p>
                If you choose to connect Google Calendar, the Service requests the{' '}
                <code className="text-[#3ECF8E] bg-white/5 px-1 py-0.5 rounded text-sm">
                  https://www.googleapis.com/auth/calendar
                </code>{' '}
                OAuth scope. We use this access exclusively to:
              </p>
              <ul className="list-disc list-inside mt-2 flex flex-col gap-1 text-zinc-400">
                <li>
                  Create calendar events for tasks you explicitly schedule within the app.
                </li>
                <li>
                  Update or delete those events when you change or remove the corresponding task.
                </li>
                <li>
                  Read existing events on the connected calendar solely to detect scheduling
                  conflicts for tasks you are actively scheduling — no event data is stored
                  beyond what is needed to display conflict warnings in the moment.
                </li>
              </ul>
              <p className="mt-3 text-zinc-400">
                We do <strong className="text-zinc-100">not</strong> read, store, index, analyse,
                or share the contents of your Google Calendar for any other purpose.
              </p>
            </Subsection>
            <Subsection title="2.4 Usage data">
              <p>
                Standard server logs (IP address, browser type, pages visited, timestamps) may be
                retained for up to 30 days for security and debugging purposes only.
              </p>
            </Subsection>
          </Section>

          <Section title="3. Google API Services User Data Policy">
            <p>
              {APP_NAME}&apos;s use and transfer to any other app of information received from
              Google APIs will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3ECF8E] hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="mt-3">
              Specifically, we confirm that:
            </p>
            <ul className="list-disc list-inside mt-2 flex flex-col gap-1.5 text-zinc-400">
              <li>
                We only request Google user data that is necessary to provide the calendar
                scheduling feature described above.
              </li>
              <li>
                We do not use Google user data to serve advertisements.
              </li>
              <li>
                We do not allow humans to read your Google data unless you have given explicit
                consent, it is necessary for security purposes, or it is required by law.
              </li>
              <li>
                We do not transfer your Google user data to third parties except as necessary
                to provide the Service (e.g., our hosting infrastructure), and never for
                advertising or data-broker purposes.
              </li>
            </ul>
          </Section>

          <Section title="4. How We Use Your Information">
            <ul className="list-disc list-inside flex flex-col gap-1.5 text-zinc-400">
              <li>To provide, maintain, and improve the Service.</li>
              <li>To authenticate you and keep your account secure.</li>
              <li>
                To sync tasks with Google Calendar when you have enabled the integration.
              </li>
              <li>To respond to support requests you initiate.</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </Section>

          <Section title="5. Data Sharing and Third Parties">
            <p>
              We do <strong className="text-zinc-100">not</strong> sell, rent, or share your
              personal data with third parties for marketing or advertising purposes.
            </p>
            <p className="mt-3">
              We use the following sub-processors solely to operate the Service:
            </p>
            <ul className="list-disc list-inside mt-2 flex flex-col gap-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-300">Supabase</strong> — database, authentication,
                and file storage (EU/US infrastructure).
              </li>
              <li>
                <strong className="text-zinc-300">Google LLC</strong> — OAuth authentication and,
                optionally, Google Calendar API.
              </li>
              <li>
                <strong className="text-zinc-300">Netlify</strong> — hosting and edge compute.
              </li>
            </ul>
            <p className="mt-3">
              Each sub-processor is bound by their own privacy and security commitments.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              Your account data is retained for as long as your account is active. You may delete
              your account at any time from the Settings page, which permanently removes all
              associated tasks, projects, and preferences. Google Calendar tokens are revoked and
              deleted upon disconnecting the integration or deleting your account.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              All data is encrypted in transit (TLS 1.2+) and at rest. Row Level Security (RLS)
              policies on our database ensure that each user can only access their own data — no
              server-side bypass is possible without explicit policy changes. OAuth tokens for
              Google Calendar are stored encrypted and scoped to your account only.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>
              Depending on your jurisdiction you may have the right to access, correct, port, or
              delete your personal data. To exercise these rights, email us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#3ECF8E] hover:underline">
                {CONTACT_EMAIL}
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          <Section title="9. Children">
            <p>
              The Service is not directed to children under 13. We do not knowingly collect
              personal data from children. If you believe a child has provided us data, please
              contact us and we will delete it promptly.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify registered
              users by email and update the effective date above. Continued use of the Service
              after changes constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions about this policy? Contact us at{' '}
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
          <Link href="/terms" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
            Terms of Service →
          </Link>
        </div>
      </main>
    </div>
  )
}

// ─── Layout helpers ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-medium text-zinc-200">{title}</h3>
      {children}
    </div>
  )
}
