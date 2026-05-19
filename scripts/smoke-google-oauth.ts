// Smoke test — valida env vars Google + gera URL de consent
process.loadEnvFile('.env.local')

async function main() {
  const { env } = await import('@/env')
  const { buildAuthUrl, generatePkcePair, GOOGLE_OAUTH_SCOPES } =
    await import('@/lib/services/google.service')

  console.log('--- env validation ---')
  const checks = {
    GOOGLE_OAUTH_CLIENT_ID: env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_ADS_DEVELOPER_TOKEN: env.GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_API_VERSION: env.GOOGLE_ADS_API_VERSION,
    GOOGLE_DATA_MANAGER_API_VERSION: env.GOOGLE_DATA_MANAGER_API_VERSION,
  }
  for (const [k, v] of Object.entries(checks)) {
    const masked = v ? `${String(v).slice(0, 6)}... (len=${String(v).length})` : 'MISSING'
    console.log(`  ${k}: ${masked}`)
  }

  // Format checks
  const errors: string[] = []
  if (!env.GOOGLE_OAUTH_CLIENT_ID?.endsWith('.apps.googleusercontent.com')) {
    errors.push('Client ID does not end in .apps.googleusercontent.com')
  }
  if (!env.GOOGLE_OAUTH_CLIENT_SECRET?.startsWith('GOCSPX-')) {
    errors.push('Client Secret does not start with GOCSPX-')
  }
  if ((env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '').length < 20) {
    errors.push('Developer Token suspiciously short (expected ~22 chars)')
  }

  if (errors.length) {
    console.log('\n--- FORMAT WARNINGS ---')
    errors.forEach((e) => console.log(`  WARN: ${e}`))
  } else {
    console.log('\n  format: OK')
  }

  console.log('\n--- buildAuthUrl smoke ---')
  console.log(`  scopes pedidos (${GOOGLE_OAUTH_SCOPES.length}):`)
  GOOGLE_OAUTH_SCOPES.forEach((s) => console.log(`    - ${s}`))

  const { codeVerifier, codeChallenge } = generatePkcePair()
  const url = buildAuthUrl({
    state: 'smoke-test-state-123',
    codeChallenge,
    redirectUri: 'http://localhost:3000/api/oauth/google/callback',
  })

  console.log(`\n  PKCE verifier len: ${codeVerifier.length}`)
  console.log(`  PKCE challenge len: ${codeChallenge.length}`)
  console.log(`\n  consent URL:`)
  console.log(`  ${url}\n`)
}

main().catch((e) => {
  console.error('SMOKE FAIL:', e)
  process.exit(1)
})
