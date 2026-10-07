import { BoxGeometry, CylinderGeometry, Euler, Matrix4, SphereGeometry, TorusGeometry } from 'three'
import type { BufferGeometry } from 'three'
import type { BuiltAsset } from '../spec/contracts'
import type { AssetSpec, Part } from '../spec/schema'
import crate from '../spec/samples/crate.json'
import lamp from '../spec/samples/lamp.json'
import mug from '../spec/samples/mug.json'
import rock from '../spec/samples/rock.json'
import tree from '../spec/samples/tree.json'

export const samples = [crate, lamp, mug, rock, tree] as AssetSpec[]

class FileReaderStub {
  result: ArrayBuffer | string | null = null
  onloadend: (() => void) | null = null
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onloadend?.()
    })
  }
}

class ImageDataStub {
  data: Uint8ClampedArray
  constructor(data: Uint8ClampedArray) {
    this.data = data
  }
}

class OffscreenCanvasStub {
  data: Uint8ClampedArray<ArrayBufferLike> = new Uint8ClampedArray()
  getContext() {
    return {
      translate() {},
      scale() {},
      putImageData: (image: ImageDataStub) => {
        this.data = image.data
      },
    }
  }
  async convertToBlob() {
    const png = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    return new Blob([png, new Uint8Array(this.data)], { type: 'image/png' })
  }
}

/** Node has no FileReader, ImageData or OffscreenCanvas, which the three.js exporters need. */
export function installCanvasStubs() {
  Object.assign(globalThis, { FileReader: FileReaderStub, ImageData: ImageDataStub, OffscreenCanvas: OffscreenCanvasStub })
}

function partGeometry(part: Part): BufferGeometry {
  const [sx, sy, sz] = part.size
  switch (part.primitive) {
    case 'box':
      return new BoxGeometry(sx, sy, sz)
    case 'cylinder':
      return new CylinderGeometry(part.taper * 0.5, 0.5, 1, part.segments).scale(sx, sy, sz)
    case 'sphere':
      return new SphereGeometry(0.5, part.segments, Math.max(2, part.segments - 1)).scale(sx, sy, sz)
    case 'torus':
      return new TorusGeometry(0.5 - part.tube * 0.5, part.tube * 0.5, 4, part.segments).scale(sx, sy, sz)
  }
}

export function buildTestAsset(spec: AssetSpec): BuiltAsset {
  const parts = spec.parts.map((part) => {
    const geometry = partGeometry(part).toNonIndexed()
    geometry.deleteAttribute('uv')
    const [rx, ry, rz] = part.rotation.map((degrees) => (degrees * Math.PI) / 180)
    geometry.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(rx, ry, rz)))
    geometry.translate(...part.position)
    return { name: part.name, paletteIndex: part.paletteIndex, geometry }
  })
  const triangles = parts.reduce((sum, part) => sum + part.geometry.getAttribute('position').count / 3, 0)
  return { name: spec.name, parts, triangles, budget: 2000 }
}
