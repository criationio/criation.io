'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export function ScriptSnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
      <code className="flex-1 font-mono text-xs break-all">{snippet}</code>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs transition hover:border-[var(--color-border-strong)]"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}
