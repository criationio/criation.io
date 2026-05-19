import FingerprintJS from '@fingerprintjs/fingerprintjs'

let fpPromise: ReturnType<typeof FingerprintJS.load> | null = null

/**
 * Captura fingerprint do browser via FingerprintJS open-source v3.
 * Retorna null em SSR, JS desabilitado, ou erro de carregamento.
 * Nunca bloqueia o submit — fingerprint e best-effort.
 */
export async function getFingerprint(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    fpPromise ??= FingerprintJS.load()
    const fp = await fpPromise
    const result = await fp.get()
    return result.visitorId
  } catch {
    return null
  }
}
