import crypto from 'node:crypto'

// Setup runs BEFORE any test module imports. Setting process.env here
// ensures @t3-oss/env-nextjs (used in src/env.ts) captures these values
// at module load time, even before tests' beforeAll() hooks run.
// (NODE_ENV is set automatically to 'test' by vitest before this runs.)

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key-placeholder'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key-placeholder'

process.env.ENCRYPTION_KEY ??= crypto.randomBytes(32).toString('hex')
process.env.ENCRYPTION_KEY_V1 ??= crypto.randomBytes(32).toString('hex')
process.env.ENCRYPTION_VERSION ??= 'v1'

process.env.UPSTASH_REDIS_REST_URL ??= 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN ??= 'test-token-placeholder'
process.env.HASH_SALT ??= crypto.randomBytes(32).toString('base64')

process.env.META_APP_ID ??= 'test-meta-app-id'
process.env.META_APP_SECRET ??= 'test-meta-app-secret'
process.env.META_GRAPH_VERSION ??= 'v25.0'

process.env.TRIGGER_SECRET_KEY ??= 'tr_dev_test-placeholder'
process.env.TRIGGER_PROJECT_REF ??= 'proj_test-placeholder'
