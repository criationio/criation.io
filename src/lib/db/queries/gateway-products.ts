import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { gatewayProducts } from '@/lib/db/schema/gateway'

export interface WorkspaceProduct {
  id: string
  name: string
  priceCents: number | null
  isSubscription: boolean | null
  providerProductId: string
}

/**
 * Lista produtos mapeados do workspace. Usado pra dropdown de filtro no
 * dashboard + select no admin de funis nomeados.
 */
export async function listWorkspaceProducts(workspaceId: string): Promise<WorkspaceProduct[]> {
  const rows = await db
    .select({
      id: gatewayProducts.id,
      name: gatewayProducts.name,
      priceCents: gatewayProducts.priceCents,
      isSubscription: gatewayProducts.isSubscription,
      providerProductId: gatewayProducts.providerProductId,
    })
    .from(gatewayProducts)
    .where(eq(gatewayProducts.workspaceId, workspaceId))
    .orderBy(gatewayProducts.name)
  return rows
}
