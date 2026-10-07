import { Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three'
import type { BuiltAsset, Settings } from '../spec/contracts'
import { cellUv, createPaletteTexture, linearColor } from './palette'

export function uvAttribute(count: number, paletteIndex: number): Float32BufferAttribute {
  const [u, v] = cellUv(paletteIndex)
  const uv = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) uv.set([u, v], i * 2)
  return new Float32BufferAttribute(uv, 2)
}

function colorAttribute(count: number, hex: string): Float32BufferAttribute {
  const { r, g, b } = linearColor(hex)
  const color = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) color.set([r, g, b], i * 3)
  return new Float32BufferAttribute(color, 3)
}

/** Group named after the asset with one named Mesh per part. Geometry is cloned, the input stays untouched. */
export function paintAsset(asset: BuiltAsset, palette: string[], mode: Settings['materialMode']): Group {
  const material = new MeshStandardMaterial({ flatShading: true, roughness: 1, metalness: 0, name: 'palette' })
  if (mode === 'texture') material.map = createPaletteTexture(palette)
  else material.vertexColors = true

  const group = new Group()
  group.name = asset.name
  for (const part of asset.parts) {
    const geometry = part.geometry.clone()
    const count = geometry.getAttribute('position').count
    if (mode === 'texture') geometry.setAttribute('uv', uvAttribute(count, part.paletteIndex))
    else geometry.setAttribute('color', colorAttribute(count, palette[part.paletteIndex]))
    const mesh = new Mesh(geometry, material)
    mesh.name = part.name
    mesh.userData.paletteIndex = part.paletteIndex
    group.add(mesh)
  }
  return group
}
