import { Mesh, PropertyBinding } from 'three'
import type { Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { strFromU8, unzipSync } from 'three/addons/libs/fflate.module.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { exportGlb, exportObjZip, paintAsset, sanitizeFileName } from '.'
import { buildTestAsset, installCanvasStubs, samples } from './testSupport'

beforeAll(installCanvasStubs)

function meshes(root: Object3D) {
  const found: Mesh[] = []
  root.traverse((child) => child instanceof Mesh && found.push(child))
  return found
}

function triangles(root: Object3D) {
  return meshes(root).reduce((sum, mesh) => sum + mesh.geometry.getAttribute('position').count / 3, 0)
}

describe.each(samples)('GLB export $name', (spec) => {
  const asset = buildTestAsset(spec)

  it('writes a valid GLB with a baseColorTexture in texture mode', async () => {
    const buffer = await (await exportGlb(paintAsset(asset, spec.palette, 'texture'))).arrayBuffer()
    const view = new DataView(buffer)
    expect(new TextDecoder().decode(buffer.slice(0, 4))).toBe('glTF')
    expect(view.getUint32(4, true)).toBe(2)
    expect(view.getUint32(8, true)).toBe(buffer.byteLength)
    const json = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + view.getUint32(12, true))))
    expect(json.materials[0].pbrMetallicRoughness.baseColorTexture).toBeDefined()
    expect(json.meshes.every((mesh: { primitives: { attributes: object }[] }) => 'TEXCOORD_0' in mesh.primitives[0].attributes)).toBe(true)
  })

  it('reloads with the same node names and triangle count', async () => {
    const group = paintAsset(asset, spec.palette, 'vertexColor')
    const buffer = await (await exportGlb(group)).arrayBuffer()
    const gltf = await new GLTFLoader().parseAsync(buffer, '')
    const names: string[] = []
    gltf.scene.traverse((child) => names.push(child.name))
    for (const part of spec.parts) expect(names).toContain(PropertyBinding.sanitizeNodeName(part.name))
    expect(gltf.scene.children[0].name).toBe(PropertyBinding.sanitizeNodeName(spec.name))
    expect(triangles(gltf.scene)).toBe(asset.triangles)
  })
})

describe.each(samples)('OBJ zip export $name', (spec) => {
  const asset = buildTestAsset(spec)

  it.each(['texture', 'vertexColor'] as const)('contains obj, mtl and png in %s mode', async (mode) => {
    const blob = await exportObjZip(paintAsset(asset, spec.palette, mode), spec.palette, spec.name)
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const base = sanitizeFileName(spec.name)
    expect(Object.keys(files).sort()).toEqual([`${base}.mtl`, `${base}.obj`, `${base}.png`])
    const obj = strFromU8(files[`${base}.obj`])
    expect(obj.startsWith(`mtllib ${base}.mtl\n`)).toBe(true)
    expect(strFromU8(files[`${base}.mtl`])).toContain(`map_Kd ${base}.png`)
    for (const part of spec.parts) expect(obj).toContain(`o ${part.name}\nusemtl palette\n`)
    expect(obj.match(/^vt /gm)?.length).toBe(obj.match(/^v /gm)?.length)
    expect(obj.match(/^f /gm)?.length).toBe(asset.triangles)
    expect(files[`${base}.png`].length).toBeGreaterThan(0)
  })
})

describe('OBJ uvs', () => {
  it('flips v so the cell center matches the PNG layout', async () => {
    const [spec] = samples
    const blob = await exportObjZip(paintAsset(buildTestAsset(spec), spec.palette, 'texture'), spec.palette, spec.name)
    const obj = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['Wooden_Crate.obj'])
    expect(obj).toContain('vt 0.125 0.875')
  })
})

describe('sanitizeFileName', () => {
  it('replaces unsafe characters and falls back to asset', () => {
    expect(sanitizeFileName(' Floor/Lamp: v2? ')).toBe('Floor_Lamp_v2')
    expect(sanitizeFileName('***')).toBe('asset')
  })
})
