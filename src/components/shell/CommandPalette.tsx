'use client'

import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { useTheme } from 'next-themes'
import { useTransition } from 'react'
import { ArrowRight, LogOut, Moon, Search, Sun, type LucideIcon } from 'lucide-react'

import { signOutAction } from '@/lib/actions/auth'
import { useCommandPaletteStore } from '@/lib/hooks/useCommandPalette'
import { cn } from '@/lib/utils'

import { NAV_GROUPS, QUICK_ACTIONS, flattenNavRoutes } from './nav-config'

export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open)
  const setOpen = useCommandPaletteStore((s) => s.setOpen)
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isPending, startTransition] = useTransition()

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    setOpen(false)
  }

  function handleSignOut() {
    setOpen(false)
    startTransition(async () => {
      const result = await signOutAction()
      if (result.ok && result.data?.redirectTo) {
        router.push(result.data.redirectTo)
        router.refresh()
      }
    })
  }

  const navRoutes = flattenNavRoutes()

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed top-[20vh] left-1/2 z-50 w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl',
            'data-[state=open]:animate-scale-in'
          )}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Buscar e navegar</Dialog.Title>

          <Command label="Comandos" className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3">
              <Search className="h-4 w-4 text-[var(--color-fg-muted)]" />
              <Command.Input
                autoFocus
                placeholder="Buscar páginas, ações…"
                className="flex h-12 w-full bg-transparent text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
              />
            </div>

            <Command.List className="max-h-[420px] overflow-y-auto p-1">
              <Command.Empty className="px-3 py-8 text-center text-xs text-[var(--color-fg-muted)]">
                Nenhum resultado para essa busca.
              </Command.Empty>

              <Command.Group
                heading="Navegação"
                className="text-label px-2 pt-2 [&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px]"
              >
                {NAV_GROUPS.flatMap((g) =>
                  g.items.map((item) => (
                    <PaletteItem
                      key={item.href}
                      icon={item.icon}
                      label={item.label}
                      hint={g.label}
                      shortcut={item.shortcut}
                      onSelect={() => go(item.href)}
                      keywords={[g.label, item.id]}
                    />
                  ))
                )}
              </Command.Group>

              <Command.Group
                heading="Sub-páginas"
                className="text-label px-2 pt-2 [&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px]"
              >
                {navRoutes
                  .filter((r) => r.label.includes('→'))
                  .map((r) => (
                    <PaletteItem
                      key={r.href}
                      icon={ArrowRight}
                      label={r.label}
                      hint={r.group}
                      onSelect={() => go(r.href)}
                      keywords={[r.group]}
                    />
                  ))}
              </Command.Group>

              <Command.Group
                heading="Ações rápidas"
                className="text-label px-2 pt-2 [&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px]"
              >
                {QUICK_ACTIONS.map((action) => (
                  <PaletteItem
                    key={action.id}
                    icon={action.icon}
                    label={action.label}
                    shortcut={'shortcut' in action ? action.shortcut : undefined}
                    onSelect={() => go(action.href)}
                  />
                ))}
              </Command.Group>

              <Command.Group
                heading="Preferências"
                className="text-label px-2 pt-2 [&_[cmdk-group-heading]]:px-1 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px]"
              >
                <PaletteItem
                  icon={theme === 'dark' ? Sun : Moon}
                  label={`Mudar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
                  onSelect={toggleTheme}
                  keywords={['tema', 'theme', 'dark', 'claro']}
                />
                <PaletteItem
                  icon={LogOut}
                  label="Sair da conta"
                  onSelect={handleSignOut}
                  keywords={['logout', 'signout', 'sair']}
                  disabled={isPending}
                />
              </Command.Group>
            </Command.List>

            <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-2 text-[10px] text-[var(--color-fg-subtle)]">
              <span>
                <kbd className="font-mono">↑↓</kbd> navegar · <kbd className="font-mono">↵</kbd>{' '}
                selecionar
              </span>
              <span>
                <kbd className="font-mono">Esc</kbd> fechar
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface PaletteItemProps {
  icon: LucideIcon
  label: string
  hint?: string | undefined
  shortcut?: string | undefined
  onSelect: () => void
  keywords?: string[] | undefined
  disabled?: boolean | undefined
}

function PaletteItem({
  icon: Icon,
  label,
  hint,
  shortcut,
  onSelect,
  keywords,
  disabled,
}: PaletteItemProps) {
  return (
    <Command.Item
      value={[label, hint, ...(keywords ?? [])].filter(Boolean).join(' ')}
      onSelect={() => {
        if (disabled) return
        onSelect()
      }}
      disabled={!!disabled}
      className={cn(
        'flex cursor-default items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-sm select-none',
        'aria-selected:bg-[var(--color-bg-muted)] aria-selected:text-[var(--color-fg)]',
        'data-[disabled=true]:opacity-50'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-muted)]" />
      <span className="flex-1 truncate text-[var(--color-fg)]">{label}</span>
      {hint && !shortcut && (
        <span className="text-[10px] text-[var(--color-fg-subtle)]">{hint}</span>
      )}
      {shortcut && (
        <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
          {shortcut}
        </span>
      )}
    </Command.Item>
  )
}
