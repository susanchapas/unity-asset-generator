import { Mesh, PropertyBinding } from 'three'
import type { Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { exportGlb, paintAsset } from './export'
import { installCanvasStubs } from './export/testSupport'
import { buildAsset } from './geometry'
import { defaultSettings, platformBudgets, type Settings } from './spec/contracts'
import { assetSpecSchema } from './spec/schema'

beforeAll(installCanvasStubs)

const samples = import.meta.glob<{ default: unknown }>('./spec/samples/*.json', { eager: true })
const specs = Object.values(samples).map((mod) => assetSpecSchema.parse(mod.default))
const cases = specs.flatMap((spec) =>
  (Object.keys(platformBudgets) as Settings['platform'][]).map((platform) => ({ name: spec.name, spec, platform })),
)

function triangles(root: Object3D) {
  let total = 0
  root.traverse((child) => {
    if (child instanceof Mesh) total += child.geometry.getAttribute('position').count / 3
  })
  return total
}

describe.each(cases)('$name on $platform', ({ spec, platform }) => {
  it('builds under budget and reloads from GLB with every part', async () => {
    const asset = buildAsset(spec, { ...defaultSettings, platform, detail: 1, roundness: 1, jitter: 1 })
    expect(asset.triangles).toBeLessThanOrEqual(platformBudgets[platform])

    const glb = await exportGlb(paintAsset(asset, spec.palette, 'vertexColor'))
    const gltf = await new GLTFLoader().parseAsync(await glb.arrayBuffer(), '')
    const names: string[] = []
    gltf.scene.traverse((child) => names.push(child.name))
    for (const part of spec.parts) expect(names).toContain(PropertyBinding.sanitizeNodeName(part.name))
    expect(triangles(gltf.scene)).toBe(asset.triangles)
  })
})
