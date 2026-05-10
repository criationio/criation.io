import { redirect } from 'next/navigation'

import { listAdsForMapping, listUtmMappings } from '@/lib/actions/utm-mappings'
import { getUtmConvention } from '@/lib/actions/utm-convention'
import { getUser } from '@/lib/supabase/server'

import { UtmMappingsClient } from './utm-mappings-client'

export default async function UtmMappingsPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const [mappingsResult, adsResult, conventionResult] = await Promise.all([
    listUtmMappings(),
    listAdsForMapping(),
    getUtmConvention(),
  ])

  const mappings = mappingsResult.ok ? mappingsResult.data : []
  const ads = adsResult.ok ? adsResult.data : []
  const convention = conventionResult.ok
    ? conventionResult.data
    : {
        usesCampaignNamePlaceholder: true,
        usesAdSetNameAsTerm: false,
        usesAdNameAsContent: false,
      }

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Mapeamentos UTM</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Override manual quando o stitcher automático não atribui (UTM custom, nome diferente do
          anúncio, etc). Cada mapping aponta uma combinação de UTMs para um anúncio específico.
        </p>
      </header>

      <UtmMappingsClient initialMappings={mappings} ads={ads} convention={convention} />
    </main>
  )
}
