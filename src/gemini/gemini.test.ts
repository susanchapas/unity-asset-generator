import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/generate.ts'
import { defaultSettings } from '../spec/contracts.ts'
import mug from '../spec/samples/mug.json'
import { generateSpec, responseJsonSchema } from './generate.ts'
import { buildSystemPrompt, buildUserPrompt } from './prompt.ts'

const mockAi = (...texts: string[]) => {
  const generateContent = vi.fn()
  texts.forEach((text) => generateContent.mockResolvedValueOnce({ text }))
  return { models: { generateContent } } as never as Parameters<typeof generateSpec>[0] & {
    models: { generateContent: typeof generateContent }
  }
}

const invalid = JSON.stringify({ ...mug, palette: [] })

describe('prompts', () => {
  it('converts the spec schema to JSON schema', () => {
    expect(responseJsonSchema.type).toBe('object')
    expect(responseJsonSchema).not.toHaveProperty('$schema')
  })

  it('includes slider values in the user prompt', () => {
    const text = buildUserPrompt('barrel', { ...defaultSettings, roundness: 0.9, detail: 0.1, paletteStyle: 'pastel', platform: 'mobile' })
    expect(text).toContain('barrel')
    expect(text).toContain('roundness 0.90')
    expect(text).toContain('detail 0.10')
    expect(text).toContain('pastel')
    expect(text).toContain('mobile')
  })

  it('includes few-shot examples in the system prompt', () => {
    expect(buildSystemPrompt()).toContain('Wooden Crate')
  })
})

describe('generateSpec', () => {
  it('returns a valid spec', async () => {
    const ai = mockAi(JSON.stringify(mug))
    await expect(generateSpec(ai, 'mug', defaultSettings)).resolves.toEqual(mug)
    expect(ai.models.generateContent).toHaveBeenCalledOnce()
  })

  it('retries once with the validation errors', async () => {
    const ai = mockAi(invalid, JSON.stringify(mug))
    await expect(generateSpec(ai, 'mug', defaultSettings)).resolves.toEqual(mug)
    const { contents } = ai.models.generateContent.mock.calls[1][0]
    expect(contents).toHaveLength(3)
    expect(contents[2].parts[0].text).toContain('palette')
  })

  it('throws after two invalid responses', async () => {
    const ai = mockAi(invalid, 'not json')
    await expect(generateSpec(ai, 'mug', defaultSettings)).rejects.toThrow(/invalid spec/)
    expect(ai.models.generateContent).toHaveBeenCalledTimes(2)
  })
})

describe('api handler', () => {
  afterEach(() => vi.unstubAllEnvs())

  const post = (body: unknown) =>
    handler.fetch(new Request('http://x/api/generate', { method: 'POST', body: JSON.stringify(body) }))

  it('returns 400 for a bad body', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'key')
    const res = await post({ prompt: '', settings: defaultSettings })
    expect(res.status).toBe(400)
    expect(await res.json()).toHaveProperty('error')
  })

  it('returns 500 when the key is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    const res = await post({ prompt: 'barrel', settings: defaultSettings })
    expect(res.status).toBe(500)
  })
})
