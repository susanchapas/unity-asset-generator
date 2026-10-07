import crate from '../spec/samples/crate.json'
import lamp from '../spec/samples/lamp.json'
import type { Settings } from '../spec/contracts.ts'

const examples = [
  { prompt: 'wooden crate', spec: crate },
  { prompt: 'floor lamp', spec: lamp },
]

export function buildSystemPrompt() {
  const shots = examples.map(({ prompt, spec }) => `Prompt: ${prompt}\nSpec: ${JSON.stringify(spec)}`).join('\n\n')

  return `You design stylized low-poly game props for Unity. You compose each prop from a few primitive parts and answer with one JSON spec only.

Rules:
- Units are meters. Y is up. Use realistic real-world scale (a mug is about 0.1 m tall, a door about 2 m).
- Parts are box, cylinder, sphere or torus.
- Parts must touch or overlap. Never leave a part floating.
- "pivot" sets the asset origin on the combined bounding box: "bottom-center" or "center". Prefer "bottom-center" for props that stand on the ground.
- "palette" has 2 to 16 hex colors. Reuse colors. Each part picks one by "paletteIndex" (zero-based).
- Name parts with short semantic PascalCase names such as Body, Handle, LeftLeg.
- Use low segment counts: 6 to 12 for most cylinders and spheres, 8 to 16 for torus. Use more only for large, important round parts.
- Keep the part count small but expressive, at most 32.

Fields:
- size: [x, y, z] bounding box of the part before rotation, in meters.
- position: center of the part's bounding box, relative to the asset origin, in meters.
- rotation: Euler angles in degrees, XYZ order.
- cylinder: taper is the top radius as a fraction of the bottom radius. 1 is a straight cylinder, 0 is a cone.
- torus: the ring lies in the XY plane. tube is the tube radius as a fraction of the outer radius, from 0.05 to 0.5.
- segments: radial segment count before the detail slider scales it.

Examples:

${shots}`
}

export function buildUserPrompt(prompt: string, settings: Settings) {
  const shape =
    settings.roundness >= 0.66
      ? 'strongly prefer rounded shapes (spheres, cylinders, tori) over angular boxes'
      : settings.roundness <= 0.33
        ? 'prefer angular, blocky shapes (boxes) over rounded ones'
        : 'mix rounded and angular shapes'
  const detail =
    settings.detail >= 0.66
      ? 'use more parts for extra detail'
      : settings.detail <= 0.33
        ? 'use as few parts as possible'
        : 'use a moderate number of parts'
  const palette =
    settings.paletteStyle === 'auto' ? 'choose colors that suit the object' : `use a ${settings.paletteStyle} color palette`

  return `Create a low-poly prop: ${prompt}

Style settings:
- roundness ${settings.roundness.toFixed(2)} of 1: ${shape}
- detail ${settings.detail.toFixed(2)} of 1: ${detail}
- paletteStyle ${settings.paletteStyle}: ${palette}
- platform ${settings.platform}: target the ${settings.platform} triangle budget, so keep part count and segments appropriate`
}
