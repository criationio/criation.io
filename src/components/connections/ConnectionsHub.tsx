'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronRight, ExternalLink, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { BrandLogo } from './BrandLogo'
import { MetaDetails } from './details/MetaDetails'
import { GatewayDetails } from './details/GatewayDetails'
import { GoogleDetails } from './details/GoogleDetails'
import { OthersDetails } from './details/OthersDetails'
import { TrackingDetails } from './details/TrackingDetails'
import type { ConnectionDescriptor } from './types'

interface Group {
  id: string
  label: string
  items: ConnectionDescriptor[]
}

interface ConnectionsHubProps {
  groups: Group[]
}

export function ConnectionsHub({ groups }: ConnectionsHubProps) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const allItems = groups.flatMap((g) => g.items)
  const open = openKey ? (allItems.find((i) => i.key === openKey) ?? null) : null

  return (
    <>
      <div className="flex flex-col gap-10">
        {groups.map((group) => (
          <section key={group.id}>
            <h2 className="mb-3 text-sm font-medium text-[var(--color-fg-muted)]">{group.label}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <CompactCard key={item.key} item={item} onOpen={() => setOpenKey(item.key)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenKey(null)}>
        <DialogContent className="max-w-[560px] gap-0 p-0">
          {open && <DetailsBody item={open} onClose={() => setOpenKey(null)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function CompactCard({ item, onOpen }: { item: ConnectionDescriptor; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 text-left transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
    >
      <BrandLogo provider={item.brand} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.name}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <StatusPill status={item.status} />
          {item.subtitle && (
            <span className="truncate text-[11px] text-[var(--color-fg-subtle)]">
              {item.subtitle}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-fg-subtle)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-fg-muted)]" />
    </button>
  )
}

function DetailsBody({ item, onClose }: { item: ConnectionDescriptor; onClose: () => void }) {
  return (
    <>
      <DialogHeader className="flex-row items-start gap-4 space-y-0 border-b border-[var(--color-border)] p-5">
        <BrandLogo provider={item.brand} size={48} />
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-lg text-[var(--color-fg)]">{item.name}</DialogTitle>
          <DialogDescription className="mt-1 flex items-center gap-2 text-[var(--color-fg-muted)]">
            <StatusPill status={item.status} />
            {item.subtitle && (
              <span className="text-xs text-[var(--color-fg-muted)]">{item.subtitle}</span>
            )}
          </DialogDescription>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </DialogHeader>

      <div className="max-h-[60vh] overflow-y-auto p-5">
        {item.kind === 'meta' && item.details?.kind === 'meta' && (
          <MetaDetails payload={item.details.payload} />
        )}
        {item.kind === 'gateway' && item.details?.kind === 'gateway' && (
          <GatewayDetails payload={item.details.payload} />
        )}
        {item.kind === 'tracking' && item.details?.kind === 'tracking' && (
          <TrackingDetails payload={item.details.payload} />
        )}
        {item.kind === 'google' && item.details?.kind === 'google' && (
          <GoogleDetails payload={item.details.payload} />
        )}
        {item.kind === 'others' && <OthersDetails />}
      </div>

      {(item.connectHref || item.manageHref) && (
        <footer className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          {item.status === 'unset' && item.connectHref && (
            <Link
              href={item.connectHref}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-xs font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
            >
              Conectar
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {item.status !== 'unset' && item.manageHref && (
            <Link
              href={item.manageHref}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 text-xs font-medium text-[var(--color-fg)] transition hover:border-[var(--color-border-strong)]"
            >
              Gerenciar
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </footer>
      )}
    </>
  )
}

const STATUS_PILL: Record<ConnectionDescriptor['status'], { label: string; className: string }> = {
  active: {
    label: 'Ativa',
    className:
      'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]',
  },
  pending: {
    label: 'Aguardando 1º evento',
    className:
      'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
  },
  failing: {
    label: 'Com erros',
    className:
      'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]',
  },
  stale: {
    label: 'Sem eventos recentes',
    className:
      'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
  },
  expired: {
    label: 'Expirada',
    className:
      'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]',
  },
  disconnected: {
    label: 'Desconectada',
    className: 'bg-[var(--color-bg)] text-[var(--color-fg-muted)] border-[var(--color-border)]',
  },
  unset: {
    label: 'Não conectado',
    className: 'bg-[var(--color-bg)] text-[var(--color-fg-subtle)] border-[var(--color-border)]',
  },
}

function StatusPill({ status }: { status: ConnectionDescriptor['status'] }) {
  const v = STATUS_PILL[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
        v.className
      )}
    >
      {v.label}
    </span>
  )
}
