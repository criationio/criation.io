import crypto from 'node:crypto'
import { describe, expect, it, beforeAll } from 'vitest'

import { decrypt, encrypt, reEncryptIfNeeded } from './encryption'

const KEY_A = crypto.randomBytes(32).toString('hex')
const KEY_B = crypto.randomBytes(32).toString('hex')

beforeAll(() => {
  process.env.ENCRYPTION_KEY = KEY_A
  process.env.ENCRYPTION_KEY_V1 = KEY_B
  process.env.ENCRYPTION_VERSION = 'v1'
})

describe('encryption', () => {
  it('encrypts and decrypts back to original', () => {
    const plaintext = 'super-secret-token-12345'
    const encrypted = encrypt(plaintext)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertexts for the same input (random IV)', () => {
    const plaintext = 'same-input'
    const a = encrypt(plaintext)
    const b = encrypt(plaintext)
    expect(a).not.toBe(b)
  })

  it('ciphertext starts with current version prefix', () => {
    const encrypted = encrypt('hello')
    expect(encrypted.startsWith('v1:')).toBe(true)
  })

  it('decrypts values encrypted with previous key version', () => {
    // Simulate encrypting with old version (v0)
    const iv = crypto.randomBytes(16)
    const oldKey = Buffer.from(KEY_B, 'hex')
    const cipher = crypto.createCipheriv('aes-256-gcm', oldKey, iv)
    const encrypted = Buffer.concat([cipher.update('old-secret', 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    const oldCiphertext = `v0:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`

    const result = decrypt(oldCiphertext)
    expect(result).toBe('old-secret')
  })

  it('reEncryptIfNeeded rotates when version differs', () => {
    // Create a ciphertext with v0 prefix using KEY_B
    const iv = crypto.randomBytes(16)
    const oldKey = Buffer.from(KEY_B, 'hex')
    const cipher = crypto.createCipheriv('aes-256-gcm', oldKey, iv)
    const encrypted = Buffer.concat([cipher.update('rotate-me', 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    const oldCiphertext = `v0:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`

    const result = reEncryptIfNeeded(oldCiphertext)
    expect(result.rotated).toBe(true)
    expect(result.value.startsWith('v1:')).toBe(true)
    expect(decrypt(result.value)).toBe('rotate-me')
  })

  it('reEncryptIfNeeded does not rotate when version matches', () => {
    const encrypted = encrypt('no-rotate')
    const result = reEncryptIfNeeded(encrypted)
    expect(result.rotated).toBe(false)
    expect(result.value).toBe(encrypted)
  })
})
