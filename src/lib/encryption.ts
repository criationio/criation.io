/**
 * Implementacao interim — single-key versionada.
 *
 * Design alvo: envelope encryption KEK/DEK (ADR-010).
 * Migracao obrigatoria: antes da Sessao 1.3 (primeiro token OAuth persistido).
 *
 * ENCRYPTION_KEY e validado em src/env.ts.
 * ENCRYPTION_KEY_V1 e ENCRYPTION_VERSION sao lidos diretamente de process.env
 * porque sao artefatos da implementacao interim e serao removidos quando
 * a migracao para envelope encryption acontecer.
 */

import crypto from 'node:crypto'

import { env } from '@/env'

interface EncryptionKey {
  version: string
  key: Buffer
}

function getCurrentVersion(): string {
  return process.env.ENCRYPTION_VERSION ?? 'v1'
}

function loadKeys(): Map<string, EncryptionKey> {
  const keys = new Map<string, EncryptionKey>()
  const currentVersion = getCurrentVersion()

  keys.set(currentVersion, {
    version: currentVersion,
    key: Buffer.from(env.ENCRYPTION_KEY, 'hex'),
  })

  const prevKey = process.env.ENCRYPTION_KEY_V1
  if (prevKey && prevKey !== env.ENCRYPTION_KEY) {
    const prevVersion = currentVersion === 'v1' ? 'v0' : 'v1'
    keys.set(prevVersion, {
      version: prevVersion,
      key: Buffer.from(prevKey, 'hex'),
    })
  }

  return keys
}

export function encrypt(plaintext: string): string {
  const currentVersion = getCurrentVersion()
  const keys = loadKeys()
  const encKey = keys.get(currentVersion)
  if (!encKey) {
    throw new Error(`Encryption key not found for version: ${currentVersion}`)
  }

  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey.key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${currentVersion}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid ciphertext format')
  }

  const [version, ivB64, authTagB64, encryptedB64] = parts as [string, string, string, string]

  const keys = loadKeys()
  const encKey = keys.get(version)
  if (!encKey) {
    throw new Error(`Encryption key not found for version: ${version}`)
  }

  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey.key, iv)
  decipher.setAuthTag(authTag)

  return decipher.update(encrypted) + decipher.final('utf8')
}

export function reEncryptIfNeeded(ciphertext: string): {
  value: string
  rotated: boolean
} {
  const currentVersion = getCurrentVersion()
  const version = ciphertext.split(':')[0]
  if (version === currentVersion) {
    return { value: ciphertext, rotated: false }
  }

  const plaintext = decrypt(ciphertext)
  return { value: encrypt(plaintext), rotated: true }
}
