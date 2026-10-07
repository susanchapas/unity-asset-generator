import { describe, expect, it } from 'vitest'
import { assetSpecSchema } from './schema'

const samples = import.meta.glob<{ default: unknown }>('./samples/*.json', { eager: true })

describe('sample specs', () => {
  it('has five samples', () => expect(Object.keys(samples)).toHaveLength(5))

  it.each(Object.entries(samples))('%s is valid', (_, mod) => {
    const result = assetSpecSchema.safeParse(mod.default)
    expect(result.error?.issues).toBeUndefined()
  })

  it('rejects a paletteIndex outside the palette', () => {
    const spec = structuredClone(samples['./samples/crate.json'].default) as { parts: { paletteIndex: number }[] }
    spec.parts[0].paletteIndex = 99
    expect(assetSpecSchema.safeParse(spec).success).toBe(false)
  })
})
