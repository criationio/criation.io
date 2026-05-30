/* eslint-disable react/no-unescaped-entities -- legal prose contém aspas e apóstrofos naturais */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Criation.io',
  description: 'The legal terms governing your use of Criation.io.',
}

const LAST_UPDATED = '2026-05-15'

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
      <header className="mb-10 border-b border-[var(--color-border)] pb-6">
        <p className="text-label mb-2">Legal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-fg)]">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">Last updated: {LAST_UPDATED}</p>
      </header>

      <article className="space-y-8 text-[15px] leading-relaxed text-[var(--color-fg)]">
        <Section title="1. Acceptance of these Terms">
          <P>
            These Terms of Service ("Terms") form a binding agreement between you (or the
            organization you represent — "you", "Customer") and{' '}
            <strong>Human Growth &amp; Freedom LTDA</strong> (trade name <strong>Whispa</strong>), a
            Brazilian limited liability company, CNPJ 62.213.634/0001-80, with registered address at
            Avenida Victor Civita, 235, Casa 49, Tambore, Santana de Parnaíba — SP, 06544-072,
            Brazil ("Criation", "we", "us"). They govern your access to and use of the Criation.io
            platform, application programming interfaces, tracking scripts, documentation, and any
            related services (collectively, the "Service").
          </P>
          <P>
            By creating an account, accepting an invitation to a workspace, or otherwise using the
            Service, you confirm that you have read, understood and agreed to these Terms and to our{' '}
            <a href="/privacy" className="underline">
              Privacy Policy
            </a>
            . If you are entering into these Terms on behalf of an organization, you represent that
            you have authority to bind that organization.
          </P>
        </Section>

        <Section title="2. Definitions">
          <UL>
            <li>
              <strong>"Account"</strong> — the individual login credentials and profile associated
              with a natural person.
            </li>
            <li>
              <strong>"Workspace"</strong> — an isolated tenant within the Service that contains a
              customer's data, configurations, and connections. A Workspace may have one or more
              members.
            </li>
            <li>
              <strong>"Credits"</strong> — the unit of consumption for Service features such as
              analyses and AI-assisted diagnostics. Credits are allocated to a Workspace monthly as
              part of the subscription plan.
            </li>
            <li>
              <strong>"Customer Data"</strong> — any data, content, or information that you, your
              workspace members, or end users of your websites submit to the Service or that the
              Service collects under your instructions.
            </li>
            <li>
              <strong>"Third-Party Platform"</strong> — any external service that the Service
              connects to under your authorization, including advertising platforms (Google Ads,
              Meta) and payment gateways (Hotmart, Kiwify, Eduzz and similar).
            </li>
          </UL>
        </Section>

        <Section title="3. Your account">
          <UL>
            <li>You must provide accurate registration information and keep it updated.</li>
            <li>
              You are responsible for safeguarding your credentials and for any activity carried out
              under your account.
            </li>
            <li>
              You must promptly notify us at{' '}
              <a href="mailto:me@heywhispa.com" className="underline">
                me@heywhispa.com
              </a>{' '}
              of any unauthorized use or security incident affecting your account.
            </li>
            <li>
              You must be at least 18 years old to use the Service. The Service is not intended for
              use by minors.
            </li>
          </UL>
        </Section>

        <Section title="4. Acceptable use">
          <P>You agree not to use the Service to:</P>
          <UL>
            <li>
              violate any law or regulation, or the terms of any Third-Party Platform you connect
              (including Google Ads policies and Meta business platform policies);
            </li>
            <li>
              upload, transmit, or store data that you do not have the right to process (including
              personal data of individuals from whom you do not have a valid legal basis);
            </li>
            <li>
              attempt to gain unauthorized access to the Service, its underlying infrastructure, or
              to other customers' workspaces;
            </li>
            <li>
              reverse engineer, decompile, or otherwise attempt to derive source code from the
              Service, except where such restriction is prohibited by law;
            </li>
            <li>
              use the Service to send unsolicited messages, fraudulent conversion events, or to
              manipulate advertising attribution in violation of platform rules;
            </li>
            <li>
              probe, scan, or test the vulnerability of the Service without our prior written
              consent, except in compliance with a published security disclosure policy if one
              exists.
            </li>
          </UL>
        </Section>

        <Section title="5. Subscriptions, credits, and billing">
          <H3>5.1 Plans</H3>
          <P>
            The Service is offered under monthly subscription plans (currently <strong>Pro</strong>,{' '}
            <strong>Advanced</strong>, and <strong>Enterprise</strong>). Each plan includes a
            monthly allocation of Credits and may include additional features as described on the
            pricing page or in your order form. Pricing, features, and Credit allocations are
            subject to change with at least 30 days' notice for existing subscriptions.
          </P>

          <H3>5.2 Credits</H3>
          <UL>
            <li>
              Credits are consumed when you run analyses or trigger features that have a Credit
              cost. Credit costs per feature are published in the application.
            </li>
            <li>
              Credits allocated in a given monthly cycle do not roll over to the next cycle and
              expire at the end of the cycle, except where a specific plan explicitly states
              otherwise.
            </li>
            <li>
              Credits have no cash value, cannot be exchanged for cash, and are not refundable
              except as required by applicable law.
            </li>
          </UL>

          <H3>5.3 Billing</H3>
          <UL>
            <li>
              Brazilian customers are billed in Brazilian Real (BRL) through <strong>Asaas</strong>.
              International customers are billed in US Dollars (USD) or other supported currencies
              through <strong>Stripe</strong>.
            </li>
            <li>
              Subscriptions renew automatically at the end of each billing cycle at the then-current
              price unless cancelled before renewal.
            </li>
            <li>
              Fees are charged in advance for each cycle. Failed payments may result in suspension
              of access until the balance is settled.
            </li>
            <li>
              All fees are exclusive of taxes; you are responsible for any applicable taxes, except
              for taxes on our net income.
            </li>
          </UL>

          <H3>5.4 Cancellation and refunds</H3>
          <UL>
            <li>
              You may cancel your subscription at any time from the application. Cancellation takes
              effect at the end of the current billing cycle; you retain access until then.
            </li>
            <li>
              Except as required by Brazilian consumer law (including the right of regret for new
              consumer subscriptions within 7 days), or where we have failed to deliver the Service
              as agreed, fees are non-refundable.
            </li>
          </UL>
        </Section>

        <Section title="6. Customer Data and our processing role">
          <UL>
            <li>
              You retain all rights, title, and interest in your Customer Data. You grant Criation a
              limited, worldwide, non-exclusive, royalty-free license to host, copy, process,
              transmit, and display your Customer Data solely to provide and improve the Service.
            </li>
            <li>
              For personal data captured on your websites, you are the <em>controller</em> and
              Criation is the <em>processor</em> (operador, under LGPD). You are responsible for
              obtaining the legal basis (including consent, where required) for processing of
              personal data of your end users.
            </li>
            <li>
              Our handling of personal data is further described in our{' '}
              <a href="/privacy" className="underline">
                Privacy Policy
              </a>
              .
            </li>
          </UL>
        </Section>

        <Section title="7. Third-Party Platforms">
          <UL>
            <li>
              When you connect a Third-Party Platform to the Service (for example, by authorizing
              OAuth access to your Google Ads account or Meta business account), you authorize
              Criation to access and process data from that platform on your behalf, strictly to
              deliver the integration you configured.
            </li>
            <li>
              You are responsible for your relationship with each Third-Party Platform, including
              compliance with their terms, accuracy of the data you send through the integration,
              and revocation of access when you no longer want Criation to use it.
            </li>
            <li>
              We are not responsible for the availability, performance, or policies of Third-Party
              Platforms, or for any data they handle outside of the integration we provide.
            </li>
          </UL>
        </Section>

        <Section title="8. Intellectual property">
          <UL>
            <li>
              The Service, including all software, documentation, designs, trademarks, and other
              materials, is owned by Criation or our licensors and is protected by applicable
              intellectual property laws.
            </li>
            <li>
              We grant you a limited, non-exclusive, non-transferable, revocable license to access
              and use the Service during the term of these Terms, solely for your internal business
              purposes.
            </li>
            <li>
              Feedback you provide about the Service is not confidential, and you grant us a
              perpetual, irrevocable, royalty-free license to use it to improve the Service.
            </li>
          </UL>
        </Section>

        <Section title="9. Service availability and changes">
          <UL>
            <li>
              We aim to keep the Service available, but we do not currently commit to a contractual
              uptime SLA. We may perform maintenance that requires temporary downtime.
            </li>
            <li>
              We may modify, add, or remove features at any time. We will give reasonable advance
              notice for material changes that materially reduce the functionality you rely on.
            </li>
          </UL>
        </Section>

        <Section title="10. Disclaimers">
          <P>
            The Service is provided "as is" and "as available". To the maximum extent permitted by
            applicable law, Criation disclaims all warranties, whether express, implied, statutory,
            or otherwise, including any warranty of merchantability, fitness for a particular
            purpose, non-infringement, or that the Service will be uninterrupted, error-free, or
            fully secure.
          </P>
          <P>
            Analyses, diagnostics, and AI-assisted recommendations generated by the Service are
            provided for informational purposes and do not constitute professional advice. You are
            responsible for the decisions you make based on them.
          </P>
        </Section>

        <Section title="11. Limitation of liability">
          <P>
            To the maximum extent permitted by applicable law, Criation will not be liable for any
            indirect, incidental, special, consequential, or punitive damages, or for any loss of
            profits, revenue, data, or goodwill, arising out of or in connection with your use of
            the Service.
          </P>
          <P>
            Our total aggregate liability for any claim arising out of or relating to these Terms or
            the Service will not exceed the greater of (a) the fees you paid to us for the Service
            in the 12 months preceding the event giving rise to the claim, or (b) one hundred
            Brazilian Reais (R$ 100,00).
          </P>
          <P>
            Nothing in these Terms limits or excludes liability that cannot be limited or excluded
            under applicable law, including liability for willful misconduct.
          </P>
        </Section>

        <Section title="12. Indemnification">
          <P>
            You agree to defend, indemnify, and hold harmless Criation and its officers, employees,
            and contractors from and against any third party claims, damages, costs, and expenses
            (including reasonable attorneys' fees) arising out of: (a) your Customer Data; (b) your
            use of the Service in violation of these Terms, applicable law, or the terms of any
            Third-Party Platform; or (c) your alleged infringement or misappropriation of any third
            party right.
          </P>
        </Section>

        <Section title="13. Termination">
          <UL>
            <li>
              You may terminate your subscription at any time from the application; termination
              follows the cancellation rules in section 5.4.
            </li>
            <li>
              We may suspend or terminate your access immediately if you materially breach these
              Terms, if continued provision of the Service would expose us to legal or security
              risk, or if your account remains unpaid after a grace period.
            </li>
            <li>
              On termination, your access to the Service ends and we will delete or anonymize your
              Customer Data within the timeframes set out in our Privacy Policy, except for records
              we are required to retain for legal or accounting purposes.
            </li>
            <li>
              Sections that by their nature should survive termination (including sections 6, 8, 10,
              11, 12, and 14) will so survive.
            </li>
          </UL>
        </Section>

        <Section title="14. Governing law and dispute resolution">
          <P>
            These Terms are governed by the laws of the Federative Republic of Brazil, without
            regard to its conflict of law provisions. Any dispute arising out of or in connection
            with these Terms or the Service will be submitted to the courts of the District of
            Santana de Parnaíba, State of São Paulo, Brazil, to the exclusion of any other, however
            privileged.
          </P>
          <P>
            This section does not affect non-waivable rights you may have under Brazilian consumer
            law as an individual consumer.
          </P>
        </Section>

        <Section title="15. Changes to these Terms">
          <P>
            We may update these Terms from time to time. When we make material changes, we will
            notify you by email and update the "Last updated" date at the top of this page.
            Continued use of the Service after a change becomes effective constitutes acceptance of
            the updated Terms.
          </P>
        </Section>

        <Section title="16. Contact">
          <P>For any questions about these Terms, please contact:</P>
          <UL>
            <li>
              <strong>Human Growth &amp; Freedom LTDA</strong> (Whispa)
            </li>
            <li>CNPJ 62.213.634/0001-80</li>
            <li>
              Avenida Victor Civita, 235, Casa 49, Tambore, Santana de Parnaíba — SP, 06544-072,
              Brazil
            </li>
            <li>
              <a href="mailto:me@heywhispa.com" className="underline">
                me@heywhispa.com
              </a>
            </li>
          </UL>
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
