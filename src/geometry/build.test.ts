import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { defaultSettings, platformBudgets, type Settings } from '../spec/contracts'
import { assetSpecSchema, type AssetSpec } from '../spec/schema'
import { buildAsset, mergeParts } from '.'

const samples = import.meta.glob<{ default: unknown }>('../spec/samples/*.json', { eager: true })
const specs = Object.entries(samples).map(([path, mod]) => [path, assetSpecSchema.parse(mod.default)] as const)
const platforms = Object.keys(platformBudgets) as Settings['platform'][]
const settingsFor = (overrides: Partial<Settings> = {}): Settings => ({ ...defaultSettings, ...overrides })

const boxSpec = (): AssetSpec => ({
  name: 'Box',
  assetType: 'prop',
  palette: ['#ffffff'],
  pivot: 'bottom-center',
  parts: [
    { name: 'Box', primitive: 'box', size: [1, 2, 3], position: [4, 5, 6], rotation: [0, 0, 0], paletteIndex: 0 },
  ],
})

const positions = (spec: AssetSpec, settings: Settings) =>
  buildAsset(spec, settings).parts.map((part) => Array.from(part.geometry.getAttribute('position').array))

describe.each(specs)('%s', (_, spec) => {
  it.each(platforms)('builds within budget on %s', (platform) => {
    const asset = buildAsset(spec, settingsFor({ platform, roundness: 1, detail: 1 }))
    expect(asset.budget).toBe(platformBudgets[platform])
    expect(asset.triangles).toBeLessThanOrEqual(asset.budget)
    const total = asset.parts.reduce((sum, part) => sum + part.geometry.getAttribute('position').count / 3, 0)
    expect(total).toBe(asset.triangles)
  })

  it('has bottom-center pivot', () => {
    const { parts } = buildAsset(spec, settingsFor())
    const bounds = new Box3()
    for (const { geometry } of parts) {
      geometry.computeBoundingBox()
      bounds.union(geometry.boundingBox!)
    }
    expect(bounds.min.y).toBeCloseTo(0)
    expect((bounds.min.x + bounds.max.x) / 2).toBeCloseTo(0)
    expect((bounds.min.z + bounds.max.z) / 2).toBeCloseTo(0)
  })

  it('has non-indexed geometry with normals and no uv or color', () => {
    for (const { geometry } of buildAsset(spec, settingsFor()).parts) {
      expect(geometry.index).toBeNull()
      expect(Object.keys(geometry.attributes).sort()).toEqual(['normal', 'position'])
    }
  })

  it('merges into one geometry', () => {
    const asset = buildAsset(spec, settingsFor())
    expect(mergeParts(asset.parts).getAttribute('position').count / 3).toBe(asset.triangles)
  })
})

describe('buildAsset', () => {
  const [, rock] = specs.find(([path]) => path.includes('rock'))!

  it('is deterministic', () => {
    const settings = settingsFor({ jitter: 1, seed: 7 })
    expect(positions(rock, settings)).toEqual(positions(rock, settings))
  })

  it('differs with another seed when jitter is above 0', () => {
    expect(positions(rock, settingsFor({ jitter: 1, seed: 1 }))).not.toEqual(positions(rock, settingsFor({ jitter: 1, seed: 2 })))
  })

  it('ignores the seed when jitter is 0', () => {
    expect(positions(rock, settingsFor({ jitter: 0, seed: 1 }))).toEqual(positions(rock, settingsFor({ jitter: 0, seed: 2 })))
  })

  it('builds a plain box with 12 triangles at roundness 0', () => {
    expect(buildAsset(boxSpec(), settingsFor({ roundness: 0 })).triangles).toBe(12)
  })

  it('chamfers a box at roundness 1', () => {
    expect(buildAsset(boxSpec(), settingsFor({ roundness: 1 })).triangles).toBeGreaterThan(12)
  })

  it('fits the part to its size before jitter', () => {
    const spec = boxSpec()
    spec.parts[0].rotation = [0, 0, 0]
    const { geometry } = buildAsset(spec, settingsFor({ jitter: 0, roundness: 1 })).parts[0]
    geometry.computeBoundingBox()
    const size = geometry.boundingBox!.getSize(new Vector3())
    expect(size.toArray()).toEqual([1, 2, 3].map((v) => expect.closeTo(v)))
  })

  it('keeps shared vertices together under jitter', () => {
    const { geometry } = buildAsset(boxSpec(), settingsFor({ jitter: 1 })).parts[0]
    const position = geometry.getAttribute('position')
    const groups = new Map<string, Set<string>>()
    const source = buildAsset(boxSpec(), settingsFor({ jitter: 0 })).parts[0].geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const key = [source.getX(i), source.getY(i), source.getZ(i)].map((v) => v.toFixed(3)).join()
      const moved = [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(3)).join()
      groups.set(key, (groups.get(key) ?? new Set()).add(moved))
    }
    expect([...groups.values()].every((moved) => moved.size === 1)).toBe(true)
  })

  it('lowers segments to meet a tight budget', () => {
    const spec = boxSpec()
    spec.parts = [0, 1, 2].map((i) => ({
      name: `Ball${i}`,
      primitive: 'sphere',
      segments: 32,
      size: [1, 1, 1],
      position: [i, 0, 0],
      rotation: [0, 0, 0],
      paletteIndex: 0,
    }))
    expect(buildAsset(spec, settingsFor({ platform: 'hero' })).triangles).toBeGreaterThan(500)
    expect(buildAsset(spec, settingsFor({ platform: 'mobile' })).triangles).toBeLessThanOrEqual(500)
  })
})
