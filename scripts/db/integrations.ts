import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envLocalPath = resolve(process.cwd(), '.env.local')
if (existsSync(envLocalPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envLocalPath)
}

async function checkResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return console.log('RESEND: NO_KEY')
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    })
    console.log('RESEND:', res.status, res.ok ? 'OK' : 'FAIL')
  } catch (err) {
    console.log('RESEND_ERROR:', (err as Error).message)
  }
}

async function checkUpstash() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return console.log('UPSTASH: NO_CREDS')
  try {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({ url, token })
    const pong = await redis.ping()
    console.log('UPSTASH_PING:', pong)
  } catch (err) {
    console.log('UPSTASH_ERROR:', (err as Error).message)
  }
}

async function checkSupabaseAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return console.log('SUPABASE_AUTH: NO_CREDS')
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(url, anon)
    const { data, error } = await sb.auth.getSession()
    console.log(
      'SUPABASE_AUTH:',
      error ? `ERR=${error.message}` : `session=${data.session === null ? 'null' : 'present'}`
    )
  } catch (err) {
    console.log('SUPABASE_AUTH_ERROR:', (err as Error).message)
  }
}

async function checkServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !sr) return console.log('SUPABASE_SR: NO_CREDS')
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(url, sr, { auth: { persistSession: false } })
    const { data, error } = await sb.from('pipeline_costs').select('pipeline_id').limit(1)
    console.log(
      'SUPABASE_SR:',
      error ? `ERR=${error.code || ''} ${error.message}` : `rows=${data?.length}`
    )
  } catch (err) {
    console.log('SUPABASE_SR_ERROR:', (err as Error).message)
  }
}

async function main() {
  await checkResend()
  await checkUpstash()
  await checkSupabaseAuth()
  await checkServiceRole()
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
