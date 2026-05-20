'use client'

/**
 * Global error boundary (App Router — TD-022).
 *
 * Captura erros de render que escaparam dos error.tsx mais especificos
 * (route segments). Envia pra Sentry e renderiza fallback minimo.
 *
 * IMPORTANTE: este boundary requer `<html>` + `<body>` proprios porque
 * substitui o root layout quando dispara — diferente dos error.tsx normais.
 */
import * as Sentry from '@sentry/nextjs'
import NextError from 'next/error'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        {/* Generic 500-style page. App Router não expõe statusCode no boundary global,
            então passamos 0 (renderiza mensagem genérica). */}
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
