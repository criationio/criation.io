'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Moon, Settings as SettingsIcon, Sun, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTransition } from 'react'

import { signOutAction } from '@/lib/actions/auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface AccountMenuProps {
  user: {
    email: string
    name: string | null
    avatarUrl: string | null
  }
  planLabel: string
}

export function AccountMenu({ user, planLabel }: AccountMenuProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isPending, startTransition] = useTransition()

  const initials = (user.name ?? user.email)
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')

  function handleSignOut() {
    startTransition(async () => {
      const result = await signOutAction()
      if (result.ok && result.data?.redirectTo) {
        router.push(result.data.redirectTo)
        router.refresh()
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-1 pr-3 transition hover:border-[var(--color-border-strong)]"
          aria-label="Conta"
        >
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px]">{initials || 'C'}</AvatarFallback>
          </Avatar>
          <span className="hidden text-xs text-[var(--color-fg-muted)] sm:inline">{planLabel}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-medium text-[var(--color-fg)]">
            {user.name ?? user.email}
          </span>
          {user.name && (
            <span className="text-xs font-normal text-[var(--color-fg-muted)]">{user.email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/configuracoes" className="flex w-full items-center gap-2">
            <User className="h-3.5 w-3.5" />
            Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/configuracoes/faturamento" className="flex w-full items-center gap-2">
            <SettingsIcon className="h-3.5 w-3.5" />
            Faturamento
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            setTheme(theme === 'dark' ? 'light' : 'dark')
          }}
          className="flex items-center gap-2"
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          Tema {theme === 'dark' ? 'claro' : 'escuro'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            handleSignOut()
          }}
          disabled={isPending}
          className="flex items-center gap-2 text-[var(--color-danger)] focus:text-[var(--color-danger)]"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
