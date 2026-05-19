/* eslint-disable react/no-unescaped-entities -- legal prose contém aspas e apóstrofos naturais */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Criation.io',
  description:
    'How Criation.io collects, uses, and protects personal data. LGPD and GDPR compliant.',
}

const LAST_UPDATED = '2026-05-15'

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
      <header className="mb-10 border-b border-[var(--color-border)] pb-6">
        <p className="text-label mb-2">Legal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-fg)]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">Last updated: {LAST_UPDATED}</p>
      </header>

      <article className="space-y-8 text-[15px] leading-relaxed text-[var(--color-fg)]">
        <Section title="1. Who we are">
          <P>
            Criation.io ("Criation", "we", "us", "our") is a software-as-a-service product operated
            by <strong>Human Growth &amp; Freedom LTDA</strong> (trade name <strong>Whispa</strong>
            ), a Brazilian limited liability company, CNPJ 62.213.634/0001-80, with registered
            address at Avenida Victor Civita, 235, Casa 49, Tambore, Santana de Parnaíba — SP,
            06544-072, Brazil. This Privacy Policy explains how we collect, use, store, share and
            protect personal data when you use Criation.io (the "Service").
          </P>
          <P>
            This policy is written to comply with the Brazilian General Data Protection Law ("LGPD",
            Federal Law no. 13.709/2018) and, where applicable to non-Brazilian users, the European
            General Data Protection Regulation ("GDPR").
          </P>
        </Section>

        <Section title="2. Who this policy applies to">
          <P>This policy applies to two categories of people:</P>
          <UL>
            <li>
              <strong>Customers and users of the Service</strong> — individuals who sign up for an
              account, are invited to a workspace, or otherwise interact with the Service through
              our web application.
            </li>
            <li>
              <strong>End users of our customers' websites</strong> — individuals whose first-party
              events (page views, leads, purchases, etc.) are captured by our customers using our
              tracking tools, and are then processed by Criation on the customer's behalf.
            </li>
          </UL>
          <P>
            For data in the second category, our customer is the <em>controller</em> and Criation
            acts as a <em>processor</em> (operador, under LGPD). Customers are responsible for
            obtaining the appropriate legal basis (including consent, when required) from their own
            end users.
          </P>
        </Section>

        <Section title="3. What information we collect">
          <H3>3.1 Account information</H3>
          <UL>
            <li>Email address, full name, password (stored only as a salted hash).</li>
            <li>Workspace name, billing country, and role within a workspace.</li>
            <li>
              Authentication metadata (sign-in timestamps, IP address hash, user-agent hash, device
              fingerprint hash for abuse prevention).
            </li>
          </UL>

          <H3>3.2 Connected platform credentials</H3>
          <UL>
            <li>
              OAuth access and refresh tokens for advertising platforms you choose to connect (e.g.,
              Google Ads, Meta), as well as connection metadata (granted scopes, connected account
              name, expiration).
            </li>
            <li>
              These tokens are encrypted at rest using AES-256-GCM with a versioned key (see section
              7).
            </li>
          </UL>

          <H3>3.3 Conversion event data captured on your customers' websites</H3>
          <P>
            When our customers install our tracking script (or send events server-to-server), we
            receive event data such as:
          </P>
          <UL>
            <li>
              Event name (e.g., <code>purchase</code>, <code>lead</code>, <code>add_to_cart</code>),
              event timestamp, event value and currency.
            </li>
            <li>
              Browser and device context — user-agent, screen size, time zone, referring URL, UTM
              parameters, click identifiers (gclid, fbclid, wbraid, gbraid).
            </li>
            <li>
              First-party user identifiers that the customer's website chooses to send: email, phone
              number, first name, last name, external ID. These identifiers are{' '}
              <strong>SHA-256 hashed</strong> before being forwarded to advertising platforms.
            </li>
            <li>
              Consent state (whether the end user granted ad-related consent on the customer's
              website, in line with Google Consent Mode v2 and equivalent frameworks).
            </li>
          </UL>

          <H3>3.4 Product usage and operational data</H3>
          <UL>
            <li>
              Pages and features used within Criation.io, request paths, response codes, performance
              metrics.
            </li>
            <li>
              Error reports (stack traces, scrubbed of payload bodies that may contain personal
              data).
            </li>
            <li>
              Audit logs of administrative actions performed by Criation employees on your data.
            </li>
          </UL>
        </Section>

        <Section title="4. Why we process this data">
          <UL>
            <li>
              <strong>To provide the Service</strong> — authenticate you, render the application,
              run analyses you request, forward conversion events to platforms you connected.
            </li>
            <li>
              <strong>To act on instructions from our customers</strong> — for data captured on
              customers' websites (section 2), we process it strictly to deliver the integrations
              and analytics the customer configures.
            </li>
            <li>
              <strong>To bill and account</strong> — issue invoices, collect payments via Asaas or
              Stripe (section 5), reconcile credit consumption.
            </li>
            <li>
              <strong>To communicate</strong> — transactional emails (account changes, billing,
              security alerts) and, only with your separate consent, product updates.
            </li>
            <li>
              <strong>To improve the product</strong> — aggregate, de-identified analytics of
              feature usage; debugging and error monitoring.
            </li>
            <li>
              <strong>To comply with the law</strong> — respond to lawful requests from public
              authorities and exercise our own rights in legal proceedings.
            </li>
            <li>
              <strong>To prevent fraud and abuse</strong> — detect anomalous sign-ups, account
              takeovers, and platform abuse.
            </li>
          </UL>
        </Section>

        <Section title="5. Legal bases for processing">
          <P>Under LGPD and GDPR, we rely on the following legal bases:</P>
          <UL>
            <li>
              <strong>Performance of a contract</strong> (LGPD art. 7, V; GDPR art. 6(1)(b)) — to
              provide the Service to you under our Terms.
            </li>
            <li>
              <strong>Compliance with legal obligations</strong> (LGPD art. 7, II; GDPR art.
              6(1)(c)) — for tax, accounting and other regulatory obligations.
            </li>
            <li>
              <strong>Legitimate interest</strong> (LGPD art. 7, IX; GDPR art. 6(1)(f)) — for
              security, fraud prevention, and product analytics that do not override your rights and
              freedoms.
            </li>
            <li>
              <strong>Consent</strong> (LGPD art. 7, I; GDPR art. 6(1)(a)) — where we ask for it
              explicitly (e.g., optional product updates by email).
            </li>
          </UL>
        </Section>

        <Section title="6. Sub-processors">
          <P>
            We use the following third-party service providers ("sub-processors") to operate the
            Service. Each sub-processor processes personal data only under our instructions and is
            bound by contractual data protection commitments.
          </P>
          <div className="my-4 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-elevated)] text-left text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
                <tr>
                  <th className="px-3 py-2">Sub-processor</th>
                  <th className="px-3 py-2">Purpose</th>
                  <th className="px-3 py-2">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                <SubprocRow
                  name="Supabase, Inc."
                  purpose="Primary database (PostgreSQL) and authentication"
                  location="São Paulo (sa-east-1)"
                />
                <SubprocRow
                  name="Vercel, Inc."
                  purpose="Application hosting and edge delivery"
                  location="São Paulo (gru1)"
                />
                <SubprocRow
                  name="Trigger.dev Ltd."
                  purpose="Background job execution"
                  location="USA / EU"
                />
                <SubprocRow
                  name="Resend, Inc."
                  purpose="Transactional email delivery"
                  location="USA"
                />
                <SubprocRow
                  name="Asaas Internet S.A."
                  purpose="Payment processing for Brazilian customers"
                  location="Brazil"
                />
                <SubprocRow
                  name="Stripe, Inc."
                  purpose="Payment processing for international customers"
                  location="USA"
                />
                <SubprocRow
                  name="Anthropic PBC"
                  purpose="AI-assisted analyses on first-party data"
                  location="USA"
                />
                <SubprocRow
                  name="PostHog, Inc."
                  purpose="Product analytics and feature usage"
                  location="USA / EU"
                />
                <SubprocRow
                  name="Functional Software, Inc. (Sentry)"
                  purpose="Error monitoring and performance"
                  location="USA"
                />
                <SubprocRow name="Better Stack" purpose="Uptime monitoring" location="EU" />
              </tbody>
            </table>
          </div>
          <P>
            We notify customers in advance of material changes to this sub-processor list (e.g., by
            updating this page and, where required, by direct notice).
          </P>
        </Section>

        <Section title="7. How we secure your data">
          <UL>
            <li>
              <strong>Encryption in transit.</strong> All data is transmitted over HTTPS/TLS 1.2 or
              higher.
            </li>
            <li>
              <strong>Encryption at rest.</strong> OAuth tokens and other sensitive credentials are
              encrypted with AES-256-GCM using a versioned key managed in our infrastructure.
            </li>
            <li>
              <strong>PII hashing for advertising fanout.</strong> When we forward first-party
              conversion identifiers to advertising platforms (Google, Meta), email, phone, first
              name and last name are SHA-256 hashed first.
            </li>
            <li>
              <strong>Tenant isolation.</strong> All persistence is gated by row-level security
              keyed to a workspace; cross-tenant data access is structurally prevented.
            </li>
            <li>
              <strong>Access control.</strong> Production data access by Criation personnel is
              restricted, logged in an immutable audit trail, and used only for support and platform
              maintenance.
            </li>
            <li>
              <strong>Log redaction.</strong> Application logs are scrubbed of personally
              identifying values at write time via path-based redaction.
            </li>
          </UL>
        </Section>

        <Section title="8. How long we keep your data">
          <UL>
            <li>
              <strong>Account data</strong> — for as long as your account is active. After
              cancellation, we retain it for up to 30 days to allow account recovery, then delete or
              anonymize it.
            </li>
            <li>
              <strong>Workspace and conversion event data</strong> — retained for as long as the
              workspace is active. After workspace deletion, data is purged within 30 days, except
              for aggregated statistics that contain no personal data.
            </li>
            <li>
              <strong>Billing and tax records</strong> — retained for 5 years after the
              corresponding fiscal year, as required by Brazilian tax law.
            </li>
            <li>
              <strong>Audit logs of administrative actions</strong> — retained for 12 months.
            </li>
            <li>
              <strong>Backups</strong> — encrypted backups are retained for up to 30 days; deletion
              requests propagate to backups within that window.
            </li>
          </UL>
        </Section>

        <Section title="9. Your rights">
          <P>
            Under LGPD (art. 18) and GDPR (art. 15-22), subject to legal limits, you have the right
            to:
          </P>
          <UL>
            <li>confirm whether we process your personal data;</li>
            <li>access the personal data we hold about you;</li>
            <li>correct incomplete, inaccurate, or outdated data;</li>
            <li>request anonymization, blocking, or deletion of unnecessary or excessive data;</li>
            <li>obtain data portability to another service provider;</li>
            <li>
              be informed about the public and private entities with which we have shared your data;
            </li>
            <li>withdraw consent at any time when processing is based on consent;</li>
            <li>object to processing that does not comply with the law;</li>
            <li>
              request a review of decisions made solely by automated processing that significantly
              affect you.
            </li>
          </UL>
          <P>
            To exercise any of these rights, contact our Data Protection Officer at the address in
            section 12. We will respond within the timeframes required by applicable law (15 days
            under LGPD; up to one month under GDPR, extendable in complex cases).
          </P>
        </Section>

        <Section title="10. International data transfers">
          <P>
            Some of our sub-processors operate outside Brazil and the European Economic Area. Where
            personal data is transferred to such locations, we rely on the legal mechanisms
            permitted by LGPD (art. 33) and GDPR (Chapter V), including contractual safeguards
            (Standard Contractual Clauses) and adequacy decisions where applicable.
          </P>
        </Section>

        <Section title="11. Children">
          <P>
            The Service is not directed to individuals under the age of 18 and we do not knowingly
            collect personal data from minors. If you become aware that a minor has provided us with
            personal data, please contact us and we will take steps to delete it.
          </P>
        </Section>

        <Section title="12. Contact and Data Protection Officer">
          <P>
            For privacy-related questions, complaints, or to exercise the rights described in
            section 9, you can contact our Data Protection Officer (Encarregado pela LGPD):
          </P>
          <UL>
            <li>
              <strong>Data Protection Officer</strong>: Vinicius Benavides
            </li>
            <li>
              <strong>Email</strong>:{' '}
              <a href="mailto:me@heywhispa.com" className="underline">
                me@heywhispa.com
              </a>
            </li>
            <li>
              <strong>Postal address</strong>: Human Growth &amp; Freedom LTDA, Avenida Victor
              Civita, 235, Casa 49, Tambore, Santana de Parnaíba — SP, 06544-072, Brazil
            </li>
          </UL>
          <P>
            You also have the right to lodge a complaint with the Brazilian National Data Protection
            Authority (ANPD) at{' '}
            <a
              href="https://www.gov.br/anpd"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              gov.br/anpd
            </a>{' '}
            or, for EU residents, with your local supervisory authority.
          </P>
        </Section>

        <Section title="13. Changes to this policy">
          <P>
            We may update this Privacy Policy from time to time. When we make material changes, we
            will notify you by email and update the "Last updated" date at the top of this page.
            Continued use of the Service after a change becomes effective constitutes acceptance of
            the updated policy.
          </P>
        </Section>
      </article>
    </main>
  )
}

// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-[var(--color-fg)]">{title}</h2>
      <div className="space-y-3 text-[var(--color-fg-muted)]">{children}</div>
    </section>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-4 mb-1 text-sm font-semibold text-[var(--color-fg)]">{children}</h3>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="leading-relaxed">{children}</p>
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="ml-5 list-disc space-y-1.5 leading-relaxed">{children}</ul>
}

function SubprocRow({
  name,
  purpose,
  location,
}: {
  name: string
  purpose: string
  location: string
}) {
  return (
    <tr>
      <td className="px-3 py-2 font-medium text-[var(--color-fg)]">{name}</td>
      <td className="px-3 py-2 text-[var(--color-fg-muted)]">{purpose}</td>
      <td className="px-3 py-2 text-xs text-[var(--color-fg-muted)]">{location}</td>
    </tr>
  )
}
