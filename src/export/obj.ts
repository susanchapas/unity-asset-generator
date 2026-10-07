import { Mesh, MeshBasicMaterial } from 'three'
import type { Object3D } from 'three'
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js'
import { strToU8, zipSync } from 'three/addons/libs/fflate.module.js'
import { uvAttribute } from './paint'
import { createPalettePng } from './palette'

export function sanitizeFileName(name: string): string {
  return name.trim().replace(/[^\w.-]+/g, '_').replace(/^[._]+|[._]+$/g, '') || 'asset'
}

/** Zip with `<name>.obj`, `<name>.mtl` and `<name>.png`. Standard right-handed OBJ, v measured from the bottom. */
export async function exportObjZip(object: Object3D, palette: string[], name: string): Promise<Blob> {
  const file = sanitizeFileName(name)
  const material = new MeshBasicMaterial({ name: 'palette' })
  const exported = object.clone()
  exported.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const geometry = child.geometry.clone()
    const count = geometry.getAttribute('position').count
    const uv = geometry.getAttribute('uv') ?? uvAttribute(count, child.userData.paletteIndex ?? 0)
    const flipped = uv.clone()
    for (let i = 0; i < count; i++) flipped.setY(i, 1 - uv.getY(i))
    geometry.setAttribute('uv', flipped)
    child.geometry = geometry
    child.material = material
  })
  exported.updateMatrixWorld(true)

  const obj = `mtllib ${file}.mtl\n${new OBJExporter().parse(exported)}`
  const mtl = `newmtl palette\nKa 1 1 1\nKd 1 1 1\nKs 0 0 0\nmap_Kd ${file}.png\n`
  const png = await createPalettePng(palette)
  const zip = zipSync({ [`${file}.obj`]: strToU8(obj), [`${file}.mtl`]: strToU8(mtl), [`${file}.png`]: png })
  return new Blob([zip as BlobPart], { type: 'application/zip' })
}
