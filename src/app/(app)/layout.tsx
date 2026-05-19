import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { CommandPalette } from '@/components/shell/CommandPalette'
import type { PlanUsageData } from '@/components/shell/PlanUsageCard'
import { Sidebar } from '@/components/shell/Sidebar'
import { TopBar } from '@/components/shell/TopBar'
import { Toaster } from '@/components/ui/sonner'
import { db } from '@/lib/db'
import { countUnreadAlertsByWorkspace } from '@/lib/db/queries/alerts'
import { getActiveSubscription, getCreditBalance } from '@/lib/db/queries/billing'
import { listRecentNotifications } from '@/lib/db/queries/notifications'
import { users, workspaceMembers, workspaces } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

const PLAN_LABELS: Record<string, string> = {
  free: 'Trial',
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
}

async function loadShellData(authUserId: string) {
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, authUserId),
  })
  if (!userRow) {
    redirect('/login')
  }

  let workspaceId = userRow.defaultWorkspaceId
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, authUserId),
    })
    workspaceId = membership?.workspaceId ?? null
  }
  if (!workspaceId) {
    redirect('/bem-vindo')
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  })
  if (!workspace) {
    redirect('/bem-vindo')
  }

  const [subscription, balance, initialNotifications, unreadAlerts] = await Promise.all([
    getActiveSubscription(workspaceId),
    getCreditBalance(workspaceId),
    listRecentNotifications({ userId: authUserId, limit: 20 }),
    countUnreadAlertsByWorkspace(workspaceId),
  ])

  const planId = subscription?.planId ?? workspace.planId ?? 'free'
  const total = subscription?.creditsPerCycle ?? 0
  const used = subscription
    ? Math.max(0, subscription.creditsPerCycle - subscription.currentCycleCreditsRemaining)
    : 0
  const totalBalance = balance?.balance ?? 0

  const daysUntilRenewal = (() => {
    const ref = subscription?.currentCycleEndsAt ?? balance?.signupExpiresAt ?? null
    if (!ref) return null
    const diffMs = new Date(ref).getTime() - Date.now()
    if (diffMs <= 0) return 0
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  })()

  const showUpgrade = (() => {
    if (planId === 'starter') return true
    if (planId === 'free' || planId === 'trial') return true
    if (subscription && total > 0) {
      const remaining = subscription.currentCycleCreditsRemaining
      const projected =
        used > 0 && daysUntilRenewal && daysUntilRenewal > 0
          ? used / Math.max(1, 30 - daysUntilRenewal)
          : 0
      return projected * 1.5 > remaining
    }
    return false
  })()

  const planUsage: PlanUsageData = {
    planId,
    used,
    total,
    balance: totalBalance,
    daysUntilRenewal,
    buckets: {
      subscription: balance?.subscriptionBalance ?? 0,
      pack: balance?.packBalance ?? 0,
      signup: balance?.signupBalance ?? 0,
      admin: balance?.adminBalance ?? 0,
    },
    showUpgrade,
  }

  return {
    user: userRow,
    workspace,
    planUsage,
    initialNotifications,
    unreadAlerts,
    planLabel: PLAN_LABELS[planId] ?? planId,
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getUser()
  if (!authUser) {
    redirect('/login')
  }

  const data = await loadShellData(authUser.id)

  const cookieStore = await cookies()
  const sidebarCollapsed = cookieStore.get('sidebar_collapsed')?.value === '1'

  return (
    <div className="flex min-h-screen w-full bg-[var(--color-bg)] text-[var(--color-fg)]">
      <Sidebar
        initialCollapsed={sidebarCollapsed}
        unreadAlerts={data.unreadAlerts}
        planUsage={data.planUsage}
        workspaceName={data.workspace.name}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          user={{
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            avatarUrl: data.user.avatarUrl,
          }}
          planLabel={data.planLabel}
          unreadAlerts={data.unreadAlerts}
          planUsage={data.planUsage}
          initialNotifications={data.initialNotifications}
        />

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>

      <CommandPalette />
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
