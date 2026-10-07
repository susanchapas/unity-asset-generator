import { describe, expect, it } from 'vitest'
import { assetSpecSchema } from '../spec/schema'
import { formatBytes } from './format'
import { buildPlaceholder, countTriangles } from './placeholder'

const samples = import.meta.glob<{ default: unknown }>('../spec/samples/*.json', { eager: true })

describe('formatBytes', () => {
  it('formats KB', () => expect(formatBytes(2048)).toBe('2.0 KB'))
  it('handles unknown size', () => expect(formatBytes(null)).toBe('—'))
})

describe('buildPlaceholder', () => {
  it.each(Object.entries(samples))('builds %s', (_, mod) => {
    const spec = assetSpecSchema.parse(mod.default)
    const group = buildPlaceholder(spec)
    expect(group.children).toHaveLength(spec.parts.length)
    expect(countTriangles(group)).toBeGreaterThan(0)
  })
})
