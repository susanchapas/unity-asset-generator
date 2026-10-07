import type { Settings } from '../spec/contracts'
import { assetSpecSchema, type AssetSpec } from '../spec/schema'

export async function requestSpec(prompt: string, settings: Settings): Promise<AssetSpec> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, settings }),
  })
  const body: unknown = await res.json().catch(() => null)

  if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? `Request failed (${res.status})`)
  return assetSpecSchema.parse(body)
}
