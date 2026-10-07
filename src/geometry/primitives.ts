import { BoxGeometry, BufferGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js'
import type { Part } from '../spec/schema'

/** Box with edges and corners chamfered by `chamfer` meters. */
function chamferedBox([x, y, z]: Part['size'], chamfer: number) {
  if (chamfer <= 0) return new BoxGeometry(x, y, z)
  const [hx, hy, hz] = [x / 2, y / 2, z / 2]
  const points: Vector3[] = []
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1])
        points.push(
          new Vector3(sx * (hx - chamfer), sy * hy, sz * hz),
          new Vector3(sx * hx, sy * (hy - chamfer), sz * hz),
          new Vector3(sx * hx, sy * hy, sz * (hz - chamfer)),
        )
  return new ConvexGeometry(points)
}

/**
 * Builds a primitive of roughly unit size (the box is built at full size). The caller fits it to the part size.
 * `segments` is ignored for boxes.
 */
export function buildPrimitive(part: Part, segments: number, roundness: number): BufferGeometry {
  switch (part.primitive) {
    case 'box':
      return chamferedBox(part.size, roundness * 0.25 * Math.min(...part.size))
    case 'cylinder':
      return new CylinderGeometry(0.5 * part.taper, 0.5, 1, segments, 1)
    case 'sphere':
      return new SphereGeometry(0.5, segments, Math.max(2, Math.round(segments / 2)))
    case 'torus': {
      const tube = 0.5 * part.tube
      return new TorusGeometry(0.5 - tube, tube, Math.max(3, Math.ceil(segments / 2)), segments)
    }
  }
}
