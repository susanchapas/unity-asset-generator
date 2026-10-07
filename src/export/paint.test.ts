import { Color, Mesh, NearestFilter, SRGBColorSpace } from 'three'
import { describe, expect, it } from 'vitest'
import { createPaletteTexture, paintAsset } from '.'
import { buildTestAsset, samples } from './testSupport'

const palette = ['#ff0000', '#00ff00', '#0000ff', '#123456', '#abcdef']

function pixel(data: Uint8Array, x: number, y: number) {
  const o = (y * 64 + x) * 4
  return [data[o], data[o + 1], data[o + 2], data[o + 3]]
}

describe('createPaletteTexture', () => {
  const texture = createPaletteTexture(palette)
  const data = texture.image.data as Uint8Array

  it('is 64x64 with nearest filtering, no mipmaps and sRGB', () => {
    expect(texture.image.width).toBe(64)
    expect(texture.image.height).toBe(64)
    expect(texture.magFilter).toBe(NearestFilter)
    expect(texture.minFilter).toBe(NearestFilter)
    expect(texture.generateMipmaps).toBe(false)
    expect(texture.colorSpace).toBe(SRGBColorSpace)
  })

  it('fills every pixel of each cell with its palette color', () => {
    palette.forEach((hex, i) => {
      const value = parseInt(hex.slice(1), 16)
      const expected = [value >> 16, (value >> 8) & 255, value & 255, 255]
      const x0 = (i % 4) * 16
      const y0 = Math.floor(i / 4) * 16
      for (const [dx, dy] of [[0, 0], [15, 0], [0, 15], [15, 15], [8, 8]]) expect(pixel(data, x0 + dx, y0 + dy)).toEqual(expected)
    })
  })

  it('leaves unused cells black', () => {
    expect(pixel(data, 16 * 3 + 5, 16 * 3 + 5)).toEqual([0, 0, 0, 255])
  })
})

describe.each(samples)('paintAsset $name', (spec) => {
  const asset = buildTestAsset(spec)

  it('names the group and meshes after the asset and parts', () => {
    const group = paintAsset(asset, spec.palette, 'texture')
    expect(group.name).toBe(spec.name)
    expect(group.children.map((child) => child.name)).toEqual(spec.parts.map((part) => part.name))
  })

  it('maps every vertex into its palette cell in texture mode', () => {
    const group = paintAsset(asset, spec.palette, 'texture')
    group.children.forEach((child, i) => {
      const { paletteIndex } = spec.parts[i]
      const mesh = child as Mesh
      const uv = mesh.geometry.getAttribute('uv')
      expect(uv.count).toBe(mesh.geometry.getAttribute('position').count)
      for (let v = 0; v < uv.count; v++) {
        expect(uv.getX(v)).toBeCloseTo(((paletteIndex % 4) + 0.5) / 4)
        expect(uv.getY(v)).toBeCloseTo((Math.floor(paletteIndex / 4) + 0.5) / 4)
      }
      expect(mesh.geometry.getAttribute('color')).toBeUndefined()
    })
    const material = (group.children[0] as Mesh).material
    expect(group.children.every((child) => (child as Mesh).material === material)).toBe(true)
    expect(material).toMatchObject({ flatShading: true, roughness: 1, metalness: 0, vertexColors: false })
    expect((material as { map: unknown }).map).not.toBeNull()
  })

  it('writes linear palette colors in vertex color mode', () => {
    const group = paintAsset(asset, spec.palette, 'vertexColor')
    group.children.forEach((child, i) => {
      const mesh = child as Mesh
      const expected = new Color(spec.palette[spec.parts[i].paletteIndex])
      const color = mesh.geometry.getAttribute('color')
      for (let v = 0; v < color.count; v++) {
        expect(color.getX(v)).toBeCloseTo(expected.r)
        expect(color.getY(v)).toBeCloseTo(expected.g)
        expect(color.getZ(v)).toBeCloseTo(expected.b)
      }
      expect(mesh.geometry.getAttribute('uv')).toBeUndefined()
    })
    const material = (group.children[0] as Mesh).material
    expect(material).toMatchObject({ vertexColors: true, map: null })
  })

  it('does not modify the input geometry', () => {
    paintAsset(asset, spec.palette, 'texture')
    expect(asset.parts.every((part) => part.geometry.getAttribute('uv') === undefined)).toBe(true)
  })
})
