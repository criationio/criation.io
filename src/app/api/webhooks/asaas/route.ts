import type { NextRequest } from 'next/server'

import { handleBillingWebhook } from '@/lib/services/billing/webhook-handler'

// Stripe SDK + Drizzle não rodam no edge.
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handleBillingWebhook('asaas', req)
}
