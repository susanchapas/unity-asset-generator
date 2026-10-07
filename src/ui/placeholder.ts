import { BoxGeometry, BufferGeometry, Box3, CylinderGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import type { AssetSpec, Part } from '../spec/schema'

function unitGeometry(part: Part): BufferGeometry {
  switch (part.primitive) {
    case 'box':
      return new BoxGeometry(1, 1, 1)
    case 'cylinder':
      return new CylinderGeometry(0.5 * part.taper, 0.5, 1, part.segments)
    case 'sphere':
      return new SphereGeometry(0.5, part.segments, Math.max(2, Math.round(part.segments / 2)))
    case 'torus': {
      const tube = 0.5 * part.tube
      return new TorusGeometry(0.5 - tube, tube, Math.max(3, Math.round(part.segments / 2)), part.segments)
    }
  }
}

function scaleFor(part: Part): [number, number, number] {
  const [x, y, z] = part.size
  return part.primitive === 'torus' ? [x, y, z / part.tube] : [x, y, z]
}

/** Temporary preview: one plain mesh per part. Replaced by the real geometry pipeline in Phase 3. */
export function buildPlaceholder(spec: AssetSpec): Group {
  const group = new Group()
  group.name = spec.name
  for (const part of spec.parts) {
    const mesh = new Mesh(
      unitGeometry(part),
      new MeshStandardMaterial({ color: spec.palette[part.paletteIndex], flatShading: true }),
    )
    mesh.name = part.name
    mesh.scale.set(...scaleFor(part))
    mesh.position.set(...part.position)
    mesh.rotation.set(MathUtils.degToRad(part.rotation[0]), MathUtils.degToRad(part.rotation[1]), MathUtils.degToRad(part.rotation[2]))
    group.add(mesh)
  }
  const box = new Box3().setFromObject(group)
  const center = box.getCenter(new Vector3())
  group.children.forEach((child) => {
    child.position.x -= center.x
    child.position.z -= center.z
    child.position.y -= spec.pivot === 'center' ? center.y : box.min.y
  })
  return group
}

export function countTriangles(group: Group): number {
  let total = 0
  group.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const geometry = child.geometry as BufferGeometry
    total += (geometry.index?.count ?? geometry.attributes.position.count) / 3
  })
  return total
}
