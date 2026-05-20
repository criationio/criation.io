'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import { withCorrelatedAction } from '@/lib/correlation'
import { db } from '@/lib/db'
import { ads, adSets, campaigns } from '@/lib/db/schema/campaigns'
import { metaAdAccounts } from '@/lib/db/schema/connections'
import { utmMappings } from '@/lib/db/schema/gateway'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

interface ActionOk<T> {
  ok: true
  data: T
}
interface ActionErr {
  ok: false
  error: { code: string; message: string }
}
type Result<T> = ActionOk<T> | ActionErr

async function resolveWorkspaceId(): Promise<Result<string>> {
  const user = await getUser()
  if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Login necessário' } }

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = membership?.workspaceId ?? null
  }
  if (!workspaceId) {
    return { ok: false, error: { code: 'NO_WORKSPACE', message: 'Workspace não encontrado' } }
  }
  return { ok: true, data: workspaceId }
}

const createSchema = z
  .object({
    utmSource: z.string().trim().max(255).nullish(),
    utmMedium: z.string().trim().max(255).nullish(),
    utmCampaign: z.string().trim().max(255).nullish(),
    utmContent: z.string().trim().max(255).nullish(),
    utmTerm: z.string().trim().max(255).nullish(),
    /**
     * Affiliate code (Hotmart Sparkle `origin.src` ou equivalente). Quando
     * preenchido sem UTMs, cria mapping affiliate-only (TD-087).
     */
    originSrc: z.string().trim().max(255).nullish(),
    adId: z.string().uuid(),
    confidenceScore: z.number().min(0).max(1).default(1),
  })
  .refine(
    (v) =>
      [v.utmSource, v.utmMedium, v.utmCampaign, v.utmContent, v.utmTerm, v.originSrc].some(
        (s) => s != null && s.length > 0
      ),
    { message: 'Pelo menos 1 UTM ou codigo de afiliado precisa estar preenchido.' }
  )

export type CreateUtmMappingInput = z.infer<typeof createSchema>

const bulkSchema = z
  .object({
    utmSource: z.string().trim().max(255).nullish(),
    utmMedium: z.string().trim().max(255).nullish(),
    utmCampaign: z.string().trim().max(255).nullish(),
    utmContent: z.string().trim().max(255).nullish(),
    utmTerm: z.string().trim().max(255).nullish(),
    originSrc: z.string().trim().max(255).nullish(),
    adIds: z.array(z.string().uuid()).min(1).max(500),
    confidenceScore: z.number().min(0).max(1).default(1),
  })
  .refine(
    (v) =>
      [v.utmSource, v.utmMedium, v.utmCampaign, v.utmContent, v.utmTerm, v.originSrc].some(
        (s) => s != null && s.length > 0
      ),
    { message: 'Pelo menos 1 UTM ou codigo de afiliado precisa estar preenchido.' }
  )

export type CreateUtmMappingsBulkInput = z.infer<typeof bulkSchema>

export async function createUtmMapping(
  input: CreateUtmMappingInput
): Promise<Result<{ id: string }>> {
  return withCorrelatedAction(async () => {
    const ws = await resolveWorkspaceId()
    if (!ws.ok) return ws

    const parsed = createSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Inválido' },
      }
    }

    // Validar que ad pertence ao workspace
    const adRow = await db.query.ads.findFirst({
      where: and(eq(ads.id, parsed.data.adId), eq(ads.workspaceId, ws.data)),
    })
    if (!adRow) {
      return { ok: false, error: { code: 'AD_NOT_FOUND', message: 'Anúncio inválido' } }
    }

    const [row] = await db
      .insert(utmMappings)
      .values({
        workspaceId: ws.data,
        utmSource: parsed.data.utmSource ?? null,
        utmMedium: parsed.data.utmMedium ?? null,
        utmCampaign: parsed.data.utmCampaign ?? null,
        utmContent: parsed.data.utmContent ?? null,
        utmTerm: parsed.data.utmTerm ?? null,
        originSrc: parsed.data.originSrc ?? null,
        adId: parsed.data.adId,
        confidenceScore: parsed.data.confidenceScore.toString(),
        strategy: 'manual',
      })
      .returning({ id: utmMappings.id })

    revalidatePath('/configuracoes/atribuicao')
    if (!row) return { ok: false, error: { code: 'INTERNAL', message: 'Insert sem retorno' } }
    return { ok: true, data: { id: row.id } }
  })
}

/**
 * Cria N mappings de uma vez — todos com a mesma combinacao de UTMs apontando
 * pra ads diferentes. Caso de uso: cliente sobe 10 anuncios da mesma campanha
 * com `utm_campaign='BF'` custom, cria 1 mapping bulk em vez de 10 manuais.
 *
 * Transacional: se 1 falha, nenhum e criado.
 */
export async function createUtmMappingsBulk(
  input: CreateUtmMappingsBulkInput
): Promise<Result<{ count: number }>> {
  return withCorrelatedAction(async () => {
    const ws = await resolveWorkspaceId()
    if (!ws.ok) return ws

    const parsed = bulkSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Inválido' },
      }
    }

    // Verifica que todos os ads pertencem ao workspace
    const adRows = await db.query.ads.findMany({
      where: and(eq(ads.workspaceId, ws.data)),
    })
    const validAdIds = new Set(adRows.map((a) => a.id))
    const invalid = parsed.data.adIds.filter((id) => !validAdIds.has(id))
    if (invalid.length > 0) {
      return {
        ok: false,
        error: { code: 'AD_NOT_FOUND', message: `${invalid.length} anúncios inválidos` },
      }
    }

    await db.insert(utmMappings).values(
      parsed.data.adIds.map((adId) => ({
        workspaceId: ws.data,
        utmSource: parsed.data.utmSource ?? null,
        utmMedium: parsed.data.utmMedium ?? null,
        utmCampaign: parsed.data.utmCampaign ?? null,
        utmContent: parsed.data.utmContent ?? null,
        utmTerm: parsed.data.utmTerm ?? null,
        originSrc: parsed.data.originSrc ?? null,
        adId,
        confidenceScore: parsed.data.confidenceScore.toString(),
        strategy: 'manual',
      }))
    )

    revalidatePath('/configuracoes/atribuicao')
    return { ok: true, data: { count: parsed.data.adIds.length } }
  })
}

export async function deleteUtmMapping(id: string): Promise<Result<{ id: string }>> {
  return withCorrelatedAction(async () => {
    const ws = await resolveWorkspaceId()
    if (!ws.ok) return ws

    const result = await db
      .delete(utmMappings)
      .where(and(eq(utmMappings.id, id), eq(utmMappings.workspaceId, ws.data)))
      .returning({ id: utmMappings.id })

    if (result.length === 0) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Mapping não encontrado' } }
    }

    revalidatePath('/configuracoes/atribuicao')
    return { ok: true, data: { id } }
  })
}

export interface UtmMappingRow {
  id: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
  originSrc: string | null
  adId: string
  adName: string
  campaignName: string
  confidenceScore: string | null
  createdAt: Date
}

export async function listUtmMappings(): Promise<Result<UtmMappingRow[]>> {
  return withCorrelatedAction(async () => {
    const ws = await resolveWorkspaceId()
    if (!ws.ok) return ws

    const rows = await db
      .select({
        id: utmMappings.id,
        utmSource: utmMappings.utmSource,
        utmMedium: utmMappings.utmMedium,
        utmCampaign: utmMappings.utmCampaign,
        utmContent: utmMappings.utmContent,
        utmTerm: utmMappings.utmTerm,
        originSrc: utmMappings.originSrc,
        adId: utmMappings.adId,
        adName: ads.name,
        campaignName: campaigns.name,
        confidenceScore: utmMappings.confidenceScore,
        createdAt: utmMappings.createdAt,
      })
      .from(utmMappings)
      .leftJoin(ads, eq(ads.id, utmMappings.adId))
      .leftJoin(adSets, eq(adSets.id, ads.adSetId))
      .leftJoin(campaigns, eq(campaigns.id, adSets.campaignId))
      .where(eq(utmMappings.workspaceId, ws.data))
      .orderBy(desc(utmMappings.createdAt))

    return {
      ok: true,
      data: rows.map((r) => ({
        ...r,
        adId: r.adId ?? '',
        adName: r.adName ?? '—',
        campaignName: r.campaignName ?? '—',
      })),
    }
  })
}

/** Helper pro form: lista ads disponiveis pra mapping (com campaign name).
 *
 * Filtra por ad_account default da connection Meta atual — ads de contas que
 * cliente removeu (trocou conta vinculada) nao aparecem. Campaigns com
 * status='ARCHIVED' (marcados por sync apos sumirem do Meta) excluidas. */
export async function listAdsForMapping(): Promise<Result<Array<{ id: string; label: string }>>> {
  return withCorrelatedAction(async () => {
    const ws = await resolveWorkspaceId()
    if (!ws.ok) return ws

    const rows = await db
      .select({
        id: ads.id,
        adName: ads.name,
        campaignName: campaigns.name,
      })
      .from(ads)
      .innerJoin(metaAdAccounts, eq(metaAdAccounts.id, ads.metaAdAccountId))
      .leftJoin(adSets, eq(adSets.id, ads.adSetId))
      .leftJoin(campaigns, eq(campaigns.id, adSets.campaignId))
      .where(
        and(
          eq(ads.workspaceId, ws.data),
          eq(ads.status, 'ACTIVE'),
          eq(metaAdAccounts.isDefault, true),
          isNull(metaAdAccounts.deletedAt),
          // Exclui ads de campaigns archived (caso sync ainda nao tenha rodado em ads)
          sql`(${campaigns.status} IS NULL OR ${campaigns.status} != 'ARCHIVED')`
        )
      )
      .limit(500)

    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        label: `${r.campaignName ?? '—'} → ${r.adName}`,
      })),
    }
  })
}
