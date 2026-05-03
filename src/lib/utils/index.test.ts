import { describe, expect, it } from 'vitest'

import { cn } from './index'

describe('cn', () => {
  it('merges tailwind classes correctly', () => {
    const result = cn('px-4 py-2', 'px-6')
    expect(result).toBe('py-2 px-6')
  })
})
