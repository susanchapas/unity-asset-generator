import { Color, DataTexture, NearestFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three'

const SIZE = 64
const GRID = 4
const CELL = SIZE / GRID

/** 64×64 texture with a 4×4 grid of 16×16 cells; cell i holds palette[i], row-major from the top-left. */
export function createPaletteTexture(palette: string[]): DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4)
  for (let i = 0; i < data.length; i += 4) data[i + 3] = 255
  palette.slice(0, GRID * GRID).forEach((hex, index) => {
    const value = parseInt(hex.slice(1), 16)
    const x0 = (index % GRID) * CELL
    const y0 = Math.floor(index / GRID) * CELL
    for (let y = y0; y < y0 + CELL; y++) {
      for (let x = x0; x < x0 + CELL; x++) {
        const o = (y * SIZE + x) * 4
        data[o] = value >> 16
        data[o + 1] = (value >> 8) & 255
        data[o + 2] = value & 255
      }
    }
  })
  const texture = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

export async function createPalettePng(palette: string[]): Promise<Uint8Array> {
  const data = createPaletteTexture(palette).image.data!
  const canvas = new OffscreenCanvas(SIZE, SIZE)
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data), SIZE, SIZE), 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return new Uint8Array(await blob.arrayBuffer())
}

/** UV of the center of a palette cell, with v measured from the top of the texture (glTF convention). */
export function cellUv(paletteIndex: number): [number, number] {
  return [((paletteIndex % GRID) + 0.5) / GRID, (Math.floor(paletteIndex / GRID) + 0.5) / GRID]
}

export function linearColor(hex: string): Color {
  return new Color(hex)
}
