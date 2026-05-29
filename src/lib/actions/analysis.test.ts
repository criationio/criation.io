// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { query: { users: { findFirst: vi.fn() }, workspaceMembers: { findFirst: vi.fn() } } },
}))
vi.mock('@/lib/db/queries/analyses', () => ({
  createAnalysis: vi.fn(),
  updateAnalysisStatus: vi.fn(),
  getAnalysisById: vi.fn(),
  updateAnalysisName: vi.fn(),
  deleteAnalysis: vi.fn(),
  setAnalysisFolder: vi.fn(),
}))
vi.mock('@/lib/db/queries/analysis-folders', () => ({
  listFoldersByWorkspace: vi.fn(),
  createFolder: vi.fn(),
  renameFolder: vi.fn(),
  deleteFolder: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db/queries/billing', () => ({ getActiveSubscription: vi.fn() }))
vi.mock('@/lib/db/queries/campaign-detail', () => ({ getCampaignCreatives: vi.fn() }))
vi.mock('@/lib/db/queries/campaigns', () => ({ listCampaignsWithMetrics: vi.fn() }))
vi.mock('@/lib/db/queries/pipeline-costs', () => ({ getPipelineCost: vi.fn() }))
vi.mock('@/lib/services/credit.service', () => ({ checkBalance: vi.fn() }))
vi.mock('@/lib/trigger/client', () => ({ triggerEstudioAnalisarVideoAd: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  analysisLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { getUser } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import {
  createAnalysis as insertAnalysis,
  deleteAnalysis as deleteAnalysisQuery,
  getAnalysisById,
  updateAnalysisName,
  updateAnalysisStatus,
} from '@/lib/db/queries/analyses'
import { getActiveSubscription } from '@/lib/db/queries/billing'
import { getPipelineCost } from '@/lib/db/queries/pipeline-costs'
import { checkBalance } from '@/lib/services/credit.service'
import { listCampaignsWithMetrics } from '@/lib/db/queries/campaigns'
import { triggerEstudioAnalisarVideoAd } from '@/lib/trigger/client'
import {
  createFolder as createFolderQuery,
  deleteFolder as deleteFolderQuery,
} from '@/lib/db/queries/analysis-folders'
import { setAnalysisFolder } from '@/lib/db/queries/analyses'
import {
  createAnalysis,
  createFolder,
  deleteAnalysis,
  deleteFolder,
  getAnalysisStatus,
  getCampaignsForPicker,
  moveAnalysisToFolder,
  renameAnalysis,
} from './analysis'

const getUserMock = getUser as unknown as ReturnType<typeof vi.fn>
const usersFindFirst = (
  db as unknown as { query: { users: { findFirst: ReturnType<typeof vi.fn> } } }
).query.users.findFirst
const insertAnalysisMock = insertAnalysis as unknown as ReturnType<typeof vi.fn>
const updateStatusMock = updateAnalysisStatus as unknown as ReturnType<typeof vi.fn>
const getSubMock = getActiveSubscription as unknown as ReturnType<typeof vi.fn>
const getCostMock = getPipelineCost as unknown as ReturnType<typeof vi.fn>
const checkBalanceMock = checkBalance as unknown as ReturnType<typeof vi.fn>
const triggerMock = triggerEstudioAnalisarVideoAd as unknown as ReturnType<typeof vi.fn>
const getAnalysisByIdMock = getAnalysisById as unknown as ReturnType<typeof vi.fn>
const listCampaignsMock = listCampaignsWithMetrics as unknown as ReturnType<typeof vi.fn>
const updateNameMock = updateAnalysisName as unknown as ReturnType<typeof vi.fn>
const deleteAnalysisQueryMock = deleteAnalysisQuery as unknown as ReturnType<typeof vi.fn>
const createFolderQueryMock = createFolderQuery as unknown as ReturnType<typeof vi.fn>
const deleteFolderQueryMock = deleteFolderQuery as unknown as ReturnType<typeof vi.fn>
const setFolderMock = setAnalysisFolder as unknown as ReturnType<typeof vi.fn>

const validInput = {
  assetType: 'video_ad',
  source: 'campaign',
  campaignId: '11111111-1111-4111-8111-111111111111',
  creativeId: '22222222-2222-4222-8222-222222222222',
  depth: 'quick',
}

describe('createAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ id: 'u1' })
    usersFindFirst.mockResolvedValue({ defaultWorkspaceId: 'w1' })
    getSubMock.mockResolvedValue({ planId: 'pro' })
    getCostMock.mockResolvedValue(1)
    checkBalanceMock.mockResolvedValue({ ok: true, available: 50 })
    insertAnalysisMock.mockResolvedValue({ id: 'a1' })
    triggerMock.mockResolvedValue({ id: 'run_123' })
  })

  it('happy path: cria row, dispara task, grava trigger_job_id', async () => {
    const res = await createAnalysis(validInput)

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.analysisId).toBe('a1')
    expect(insertAnalysisMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'w1', userId: 'u1', status: 'queued' })
    )
    expect(triggerMock).toHaveBeenCalledOnce()
    expect(updateStatusMock).toHaveBeenCalledWith('a1', { triggerJobId: 'run_123' })
  })

  it('rejeita input inválido sem tocar no banco', async () => {
    const res = await createAnalysis({ ...validInput, campaignId: 'not-a-uuid' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('INVALID')
    expect(insertAnalysisMock).not.toHaveBeenCalled()
  })

  it('bloqueia quando não autenticado', async () => {
    getUserMock.mockResolvedValue(null)
    const res = await createAnalysis(validInput)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('UNAUTHORIZED')
  })

  it('bloqueia saldo insuficiente antes de criar a análise', async () => {
    checkBalanceMock.mockResolvedValue({ ok: false, available: 0 })
    const res = await createAnalysis(validInput)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('INSUFFICIENT_CREDITS')
    expect(insertAnalysisMock).not.toHaveBeenCalled()
    expect(triggerMock).not.toHaveBeenCalled()
  })

  it('marca failed se o disparo da task falhar', async () => {
    triggerMock.mockRejectedValue(new Error('trigger down'))
    const res = await createAnalysis(validInput)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('TRIGGER_FAILED')
    expect(updateStatusMock).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ status: 'failed' })
    )
  })
})

describe('getAnalysisStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ id: 'u1' })
    usersFindFirst.mockResolvedValue({ defaultWorkspaceId: 'w1' })
    getSubMock.mockResolvedValue({ planId: 'pro' })
  })

  it('retorna o status da análise (workspace-scoped)', async () => {
    getAnalysisByIdMock.mockResolvedValue({ analysis: { status: 'completed' }, result: null })
    const res = await getAnalysisStatus('a1')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.status).toBe('completed')
    expect(getAnalysisByIdMock).toHaveBeenCalledWith('w1', 'a1')
  })

  it('NOT_FOUND quando a análise não existe no workspace', async () => {
    getAnalysisByIdMock.mockResolvedValue(null)
    const res = await getAnalysisStatus('a1')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('NOT_FOUND')
  })

  it('bloqueia quando não autenticado', async () => {
    getUserMock.mockResolvedValue(null)
    const res = await getAnalysisStatus('a1')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('UNAUTHORIZED')
  })
})

describe('getCampaignsForPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ id: 'u1' })
    usersFindFirst.mockResolvedValue({ defaultWorkspaceId: 'w1' })
    getSubMock.mockResolvedValue({ planId: 'pro' })
  })

  it('lista campanhas ACTIVE da conta (filtra por adAccountId)', async () => {
    listCampaignsMock.mockResolvedValue({
      rows: [{ id: 'c1', name: 'Camp 1', status: 'ACTIVE' }],
      total: 1,
    })
    const res = await getCampaignsForPicker('act_123')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data).toEqual([{ id: 'c1', name: 'Camp 1', status: 'ACTIVE' }])
    expect(listCampaignsMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'w1', adAccountId: 'act_123', status: 'ACTIVE' })
    )
  })

  it('rejeita sem adAccountId', async () => {
    const res = await getCampaignsForPicker('')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('INVALID')
    expect(listCampaignsMock).not.toHaveBeenCalled()
  })
})

describe('renameAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ id: 'u1' })
    usersFindFirst.mockResolvedValue({ defaultWorkspaceId: 'w1' })
    getSubMock.mockResolvedValue({ planId: 'pro' })
  })

  it('renomeia (workspace-scoped)', async () => {
    const res = await renameAnalysis({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Meu anúncio top',
    })
    expect(res.ok).toBe(true)
    expect(updateNameMock).toHaveBeenCalledWith(
      'w1',
      '11111111-1111-4111-8111-111111111111',
      'Meu anúncio top'
    )
  })

  it('rejeita nome vazio sem tocar no banco', async () => {
    const res = await renameAnalysis({ id: '11111111-1111-4111-8111-111111111111', name: '   ' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('INVALID')
    expect(updateNameMock).not.toHaveBeenCalled()
  })
})

describe('deleteAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ id: 'u1' })
    usersFindFirst.mockResolvedValue({ defaultWorkspaceId: 'w1' })
    getSubMock.mockResolvedValue({ planId: 'pro' })
  })

  it('apaga (workspace-scoped)', async () => {
    const res = await deleteAnalysis('a1')
    expect(res.ok).toBe(true)
    expect(deleteAnalysisQueryMock).toHaveBeenCalledWith('w1', 'a1')
  })

  it('bloqueia quando não autenticado', async () => {
    getUserMock.mockResolvedValue(null)
    const res = await deleteAnalysis('a1')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('UNAUTHORIZED')
    expect(deleteAnalysisQueryMock).not.toHaveBeenCalled()
  })
})

describe('pastas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ id: 'u1' })
    usersFindFirst.mockResolvedValue({ defaultWorkspaceId: 'w1' })
    getSubMock.mockResolvedValue({ planId: 'pro' })
  })

  it('createFolder cria com createdBy = user (workspace-scoped)', async () => {
    createFolderQueryMock.mockResolvedValue({ id: 'f1' })
    const res = await createFolder({ name: 'Campanhas Q2' })
    expect(res.ok).toBe(true)
    expect(createFolderQueryMock).toHaveBeenCalledWith({
      workspaceId: 'w1',
      name: 'Campanhas Q2',
      createdBy: 'u1',
    })
  })

  it('createFolder rejeita nome vazio', async () => {
    const res = await createFolder({ name: '  ' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('INVALID')
    expect(createFolderQueryMock).not.toHaveBeenCalled()
  })

  it('deleteFolder apaga (workspace-scoped)', async () => {
    const res = await deleteFolder('f1')
    expect(res.ok).toBe(true)
    expect(deleteFolderQueryMock).toHaveBeenCalledWith('w1', 'f1')
  })

  it('moveAnalysisToFolder move pra pasta', async () => {
    const res = await moveAnalysisToFolder({
      analysisId: '11111111-1111-4111-8111-111111111111',
      folderId: '22222222-2222-4222-8222-222222222222',
    })
    expect(res.ok).toBe(true)
    expect(setFolderMock).toHaveBeenCalledWith(
      'w1',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    )
  })

  it('moveAnalysisToFolder aceita folderId null (tira da pasta)', async () => {
    const res = await moveAnalysisToFolder({
      analysisId: '11111111-1111-4111-8111-111111111111',
      folderId: null,
    })
    expect(res.ok).toBe(true)
    expect(setFolderMock).toHaveBeenCalledWith('w1', '11111111-1111-4111-8111-111111111111', null)
  })
})
