import { z } from 'zod'

/** Meters, Y-up, right-handed (three.js / glTF). Export converts to Unity. */
const vec3 = z.tuple([z.number(), z.number(), z.number()])
const size = z.tuple([z.number().min(0.01).max(10), z.number().min(0.01).max(10), z.number().min(0.01).max(10)])
const position = z.tuple([z.number().min(-10).max(10), z.number().min(-10).max(10), z.number().min(-10).max(10)])
const segments = z.int().min(3).max(64)

const partBase = {
  name: z.string().min(1).max(40),
  /** Bounding box [x, y, z] of the part before rotation. */
  size,
  /** Center of the part's bounding box, relative to the asset origin. */
  position,
  /** Euler angles in degrees, XYZ order. */
  rotation: vec3,
  paletteIndex: z.int().min(0),
}

export const partSchema = z.discriminatedUnion('primitive', [
  z.object({ ...partBase, primitive: z.literal('box') }),
  z.object({
    ...partBase,
    primitive: z.literal('cylinder'),
    /** Radial segment count before the detail slider scales it. */
    segments,
    /** Top radius as a fraction of the bottom radius. 0 makes a cone. */
    taper: z.number().min(0).max(1),
  }),
  z.object({ ...partBase, primitive: z.literal('sphere'), segments }),
  z.object({
    ...partBase,
    primitive: z.literal('torus'),
    segments,
    /** Tube radius as a fraction of the outer radius. Ring lies in the XY plane. */
    tube: z.number().min(0.05).max(0.5),
  }),
])

export const assetSpecSchema = z
  .object({
    name: z.string().min(1).max(40),
    assetType: z.literal('prop'),
    /** Up to 16 colors, one per 16×16 cell of the 64×64 palette texture. */
    palette: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).min(1).max(16),
    /** Where the asset origin sits on its combined bounding box. */
    pivot: z.enum(['bottom-center', 'center']),
    parts: z.array(partSchema).min(1).max(32),
  })
  .superRefine((spec, ctx) => {
    spec.parts.forEach((part, i) => {
      if (part.paletteIndex >= spec.palette.length)
        ctx.addIssue({ code: 'custom', path: ['parts', i, 'paletteIndex'], message: 'paletteIndex is out of palette range' })
    })
  })

export type Part = z.infer<typeof partSchema>
export type AssetSpec = z.infer<typeof assetSpecSchema>
