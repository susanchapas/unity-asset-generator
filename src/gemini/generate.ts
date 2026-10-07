import type { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import type { Settings } from '../spec/contracts.ts'
import { assetSpecSchema, type AssetSpec } from '../spec/schema.ts'
import { buildSystemPrompt, buildUserPrompt } from './prompt.ts'

export const model = 'gemini-2.5-flash'

export const { $schema: _, ...responseJsonSchema } = z.toJSONSchema(assetSpecSchema)

type Content = { role: 'user' | 'model'; parts: { text: string }[] }

/** Asks Gemini for an asset spec, retrying once with the validation issues. */
export async function generateSpec(ai: Pick<GoogleGenAI, 'models'>, prompt: string, settings: Settings): Promise<AssetSpec> {
  const contents: Content[] = [{ role: 'user', parts: [{ text: buildUserPrompt(prompt, settings) }] }]
  let problem = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(),
        responseMimeType: 'application/json',
        responseJsonSchema,
      },
    })
    const text = response.text ?? ''

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      problem = 'The response was not valid JSON.'
    }
    if (json !== undefined) {
      const result = assetSpecSchema.safeParse(json)
      if (result.success) return result.data
      problem = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
    }

    contents.push(
      { role: 'model', parts: [{ text }] },
      { role: 'user', parts: [{ text: `The spec is invalid. Fix these issues and answer with the full corrected JSON spec:\n${problem}` }] },
    )
  }

  throw new Error(`Gemini returned an invalid spec after a retry:\n${problem}`)
}
