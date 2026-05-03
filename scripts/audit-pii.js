#!/usr/bin/env node
// @ts-check

const { execSync } = require('child_process')
const path = require('path')

const PATTERNS = [
  { name: 'Email', regex: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}' },
  { name: 'CPF', regex: '\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}' },
  { name: 'Phone BR', regex: '(\\+55|0)?[\\s\\-]?\\(?[1-9]{2}\\)?[\\s\\-]?[9]?[0-9]{4}[\\s\\-]?[0-9]{4}' },
  { name: 'Token/Key in log', regex: '("token"|"key"|"secret"|"password")\\s*:\\s*"[^"]{10,}"' },
]

const IGNORE_DIRS = ['node_modules', '.next', 'src/lib/db/schema', '.git', 'coverage', 'dist']

const ignoreArgs = IGNORE_DIRS.map((d) => `--exclude-dir=${d}`).join(' ')

let found = false

for (const pattern of PATTERNS) {
  try {
    const result = execSync(
      `grep -rn ${ignoreArgs} -E '${pattern.regex}' src/ logs/ 2>/dev/null || true`,
      { cwd: path.resolve(__dirname, '..'), encoding: 'utf-8' },
    )

    const lines = result.trim().split('\n').filter(Boolean)

    // Filter out false positives from test files, env examples, and schema definitions
    const realHits = lines.filter((line) => {
      if (line.includes('.env.example')) return false
      if (line.includes('.test.ts') || line.includes('.test.tsx')) return false
      if (line.includes('audit-pii')) return false
      if (line.includes('// ') && line.includes('regex')) return false
      return true
    })

    if (realHits.length > 0) {
      found = true
      console.error(`\n[PII DETECTED] ${pattern.name}:`)
      for (const line of realHits) {
        console.error(`  ${line}`)
      }
    }
  } catch {
    // grep returns exit 1 when no match, which is fine
  }
}

if (found) {
  console.error('\nPII audit FAILED — review the above matches and redact or remove them.')
  process.exit(1)
} else {
  console.log('PII audit passed — no unredacted PII found.')
  process.exit(0)
}
