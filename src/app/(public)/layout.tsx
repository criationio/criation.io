import Link from 'next/link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--color-border)] py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-[var(--color-fg-muted)]">
          <p className="font-medium text-[var(--color-fg)]">Criation.io</p>
          <p className="mt-1 text-xs">
            Operated by Human Growth &amp; Freedom LTDA · CNPJ 62.213.634/0001-80
          </p>
        </div>

        <nav
          aria-label="Legal and informational links"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
        >
          <Link
            href="/privacy"
            className="text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Terms of Service
          </Link>
          <a
            href="mailto:me@heywhispa.com"
            className="text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  )
}
