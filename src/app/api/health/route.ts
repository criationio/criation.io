import { NextResponse } from 'next/server'

const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'

export function GET() {
  const checks: Record<string, boolean> = {
    database_url: !!process.env.DATABASE_URL,
    anthropic_api_key: !!process.env.ANTHROPIC_API_KEY,
  }

  const allHealthy = Object.values(checks).every(Boolean)

  return NextResponse.json(
    {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version,
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  )
}
