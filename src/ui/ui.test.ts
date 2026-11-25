import { describe, expect, it } from 'vitest'
import { formatBytes } from './format'

describe('formatBytes', () => {
  it('formats KB', () => expect(formatBytes(2048)).toBe('2.0 KB'))
  it('handles unknown size', () => expect(formatBytes(null)).toBe('—'))
})
