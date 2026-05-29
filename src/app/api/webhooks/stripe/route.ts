import type { NextRequest } from 'next/server'

import { handleBillingWebhook } from '@/lib/services/billing/webhook-handler'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handleBillingWebhook('stripe', req)
}
