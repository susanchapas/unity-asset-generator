import type { BufferGeometry } from 'three'
import { z } from 'zod'

/** Maximum triangles per asset for each platform preset. */
export const platformBudgets = { mobile: 500, desktop: 2000, hero: 8000 } as const

export const settingsSchema = z.object({
  assetType: z.literal('prop'),
  /** 0 to 1. 0.5 keeps spec segment counts; lower reduces them, higher increases them. */
  detail: z.number().min(0).max(1),
  platform: z.enum(['mobile', 'desktop', 'hero']),
  /** 0 to 1. Chamfer on box edges, and a hint to Gemini to prefer rounded shapes. */
  roundness: z.number().min(0).max(1),
  /** 0 to 1. Vertex jitter amplitude; 1 moves vertices up to 5% of the part's smallest size. */
  jitter: z.number().min(0).max(1),
  /** Palette style hint for Gemini. */
  paletteStyle: z.enum(['auto', 'warm', 'cool', 'pastel', 'muted']),
  seed: z.int().min(0).max(2 ** 31 - 1),
  materialMode: z.enum(['texture', 'vertexColor']),
})

export type Settings = z.infer<typeof settingsSchema>

export const referenceImageSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  /** Base64 image bytes, without the data URL prefix. */
  data: z.base64().max(4_000_000),
})

export type ReferenceImage = z.infer<typeof referenceImageSchema>

export const defaultSettings: Settings = {
  assetType: 'prop',
  detail: 0.5,
  platform: 'desktop',
  roundness: 0,
  jitter: 0.2,
  paletteStyle: 'auto',
  seed: 1,
  materialMode: 'texture',
}

export interface BuiltPart {
  name: string
  paletteIndex: number
  /** Non-indexed, flat normals, in asset space with the pivot applied. No uv or color attributes. */
  geometry: BufferGeometry
}

export interface BuiltAsset {
  name: string
  parts: BuiltPart[]
  triangles: number
  budget: number
  /** Translation applied to every part so the pivot sits at the origin. */
  pivotOffset: [number, number, number]
}
