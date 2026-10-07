import type { Object3D } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

export async function exportGlb(object: Object3D): Promise<Blob> {
  const glb = await new GLTFExporter().parseAsync(object, { binary: true })
  return new Blob([glb as ArrayBuffer], { type: 'model/gltf-binary' })
}
