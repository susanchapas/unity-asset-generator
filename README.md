# 3D Asset Generator

A browser-based tool for creating low-poly Unity-ready props from a text prompt. It will turn a prompt into a structured asset specification, build the geometry, preview it in 3D, and export GLB or OBJ assets.

The project is currently in its foundation phase: the Vite/React/TypeScript app, the shared Zod specification, and five validated sample asset specs are in place. Gemini generation, mesh building, preview, and export are planned next.

## What it will do

- Generate stylized prop specifications from prompts with Gemini.
- Build low-poly meshes from boxes, cylinders, spheres, and tori.
- Control detail, roundness, vertex jitter, palette, material mode, platform preset, and seed.
- Preview the asset with orbit controls and show triangle count and estimated file size.
- Export Unity-ready GLB or a ZIP containing OBJ, MTL, and PNG palette texture files.

## Requirements

- Node.js 20 or later
- npm
- For Unity import testing: a Unity project with [glTFast](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@latest) installed

Gemini API and deployment credentials are not needed to run the current foundation locally.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints in the terminal.

Other useful commands:

```bash
npm test       # validate all sample specs
npm run lint   # lint the project
npm run build  # type-check and create a production build
npm run preview
```

## Asset specification

The shared schema is defined in [`src/spec/schema.ts`](src/spec/schema.ts). It is the contract for generation, geometry, UI, and export work.

An asset spec includes:

- `name` and `assetType` (`prop` in v1)
- A palette of 1–16 hex colors
- A `bottom-center` or `center` pivot
- Up to 32 named parts, each with size, position, XYZ rotation, and palette index
- One of four primitives: `box`, `cylinder`, `sphere`, or `torus`

Geometry uses meters, a Y-up right-handed coordinate system, and degrees for Euler rotations. Export will convert the result for Unity.

```json
{
  "name": "Crate",
  "assetType": "prop",
  "palette": ["#a86636", "#713d22"],
  "pivot": "bottom-center",
  "parts": [
    {
      "name": "body",
      "primitive": "box",
      "size": [1, 1, 1],
      "position": [0, 0.5, 0],
      "rotation": [0, 0, 0],
      "paletteIndex": 0
    }
  ]
}
```

Primitive-specific fields are required for non-box parts:

- `cylinder`: `segments` (3–64) and `taper` (0–1; `0` creates a cone)
- `sphere`: `segments` (3–64)
- `torus`: `segments` (3–64) and `tube` (0.05–0.5)

## Sample specs

Five hand-authored specifications live in [`src/spec/samples`](src/spec/samples): crate, mug, tree, lamp, and rock. The Vitest suite validates every sample and confirms invalid palette references are rejected.

## Planned build phases

1. **Foundation** — app scaffold, shared schema, and sample specs. Complete.
2. **Core build** — Gemini prompt service, primitive-to-mesh geometry, UI/3D preview, materials, and GLB/OBJ export.
3. **Integration and Unity testing** — connect the pipeline, test exports, and verify scale, pivot, orientation, colors, and point-filtered palette textures in Unity.
4. **Polish and deployment** — tune Mobile/Desktop/Hero presets, add history and batch variations, rate-limit requests, and deploy.

## Development conventions

- Keep implementation work within its domain (`src/gemini`, `src/geometry`, `src/ui`, or `src/export`).
- Treat the Zod schema as shared, versioned contract; coordinate any changes before modifying it.
- Validate against all five sample specs before merging changes.
- Keep API keys in a serverless environment variable—never in browser code or committed files.

## License

No license has been selected yet.
