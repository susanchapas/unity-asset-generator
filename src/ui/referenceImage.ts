import type { ReferenceImage } from '../spec/contracts'

/** Downscales an image file to a JPEG that fits the request body limit. */
export async function loadReferenceImage(file: File, maxSize = 1024): Promise<ReferenceImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return { mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] }
}

export const imageUrl = ({ mimeType, data }: ReferenceImage) => `data:${mimeType};base64,${data}`
