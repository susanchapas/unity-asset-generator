import { Box3, BufferGeometry, Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { platformBudgets, type BuiltAsset, type BuiltPart, type Settings } from '../spec/contracts'
import type { AssetSpec, Part } from '../spec/schema'
import { buildPrimitive } from './primitives'
import { mulberry32 } from './prng'

const MIN_SEGMENTS = 3
const MAX_SEGMENTS = 64

const scaledSegments = (part: Part, detail: number) =>
  'segments' in part
    ? Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, Math.round(part.segments * 2 ** (detail * 2 - 1))))
    : MIN_SEGMENTS

const triangleCount = (geometry: BufferGeometry) => geometry.getAttribute('position').count / 3

/** Scales and centers the geometry so its bounding box is exactly `size`. */
function fitToSize(geometry: BufferGeometry, size: Part['size']) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  const extent = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  geometry.translate(-center.x, -center.y, -center.z)
  geometry.scale(size[0] / extent.x, size[1] / extent.y, size[2] / extent.z)
}

/** Vertices sharing a position get the same offset, so no cracks open. */
function jitterVertices(geometry: BufferGeometry, amplitude: number, seed: number) {
  if (amplitude <= 0) return
  const random = mulberry32(seed)
  const offsets = new Map<string, number[]>()
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)]
    const key = [x, y, z].map((v) => Math.round(v * 1e4)).join()
    let offset = offsets.get(key)
    if (!offset) {
      offset = [0, 0, 0].map(() => (random() * 2 - 1) * amplitude)
      offsets.set(key, offset)
    }
    position.setXYZ(i, x + offset[0], y + offset[1], z + offset[2])
  }
}

function buildPart(part: Part, index: number, segments: number, settings: Settings) {
  const raw = buildPrimitive(part, segments, settings.roundness)
  const geometry = raw.index ? raw.toNonIndexed() : raw
  for (const name of Object.keys(geometry.attributes)) if (name !== 'position') geometry.deleteAttribute(name)
  fitToSize(geometry, part.size)
  jitterVertices(geometry, settings.jitter * 0.05 * Math.min(...part.size), settings.seed + index * 7919)
  const [rx, ry, rz] = part.rotation.map(MathUtils.degToRad)
  const rotation = new Quaternion().setFromEuler(new Euler(rx, ry, rz, 'XYZ'))
  geometry.applyMatrix4(new Matrix4().compose(new Vector3(...part.position), rotation, new Vector3(1, 1, 1)))
  return geometry
}

function applyPivot(geometries: BufferGeometry[], pivot: AssetSpec['pivot']) {
  const bounds = new Box3()
  for (const geometry of geometries) {
    geometry.computeBoundingBox()
    bounds.union(geometry.boundingBox!)
  }
  const center = bounds.getCenter(new Vector3())
  const offset = new Vector3(-center.x, pivot === 'center' ? -center.y : -bounds.min.y, -center.z)
  for (const geometry of geometries) {
    geometry.translate(offset.x, offset.y, offset.z)
    geometry.computeVertexNormals()
  }
}

/** Builds every part, then lowers segment counts of the largest parts until the platform budget is met. */
export function buildAsset(spec: AssetSpec, settings: Settings): BuiltAsset {
  const budget = platformBudgets[settings.platform]
  const segments = spec.parts.map((part) => scaledSegments(part, settings.detail))
  const geometries = spec.parts.map((part, i) => buildPart(part, i, segments[i], settings))
  const triangles = geometries.map(triangleCount)

  const total = () => triangles.reduce((sum, n) => sum + n, 0)
  while (total() > budget) {
    let target = -1
    spec.parts.forEach((part, i) => {
      const reducible = part.primitive !== 'box' && segments[i] > MIN_SEGMENTS
      if (reducible && (target < 0 || triangles[i] > triangles[target])) target = i
    })
    if (target < 0) break
    segments[target]--
    geometries[target] = buildPart(spec.parts[target], target, segments[target], settings)
    triangles[target] = triangleCount(geometries[target])
  }

  applyPivot(geometries, spec.pivot)
  const parts = spec.parts.map(({ name, paletteIndex }, i) => ({ name, paletteIndex, geometry: geometries[i] }))
  return { name: spec.name, parts, triangles: total(), budget }
}

export function mergeParts(parts: BuiltPart[]): BufferGeometry {
  const merged = mergeGeometries(parts.map((part) => part.geometry))
  if (!merged) throw new Error('Parts have incompatible geometry attributes')
  return merged
}
