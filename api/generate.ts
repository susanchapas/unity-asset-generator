import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { generateSpec } from '../src/gemini/generate.ts'
import { settingsSchema } from '../src/spec/contracts.ts'

const bodySchema = z.object({ prompt: z.string().min(1).max(500), settings: settingsSchema })

const json = (body: unknown, status = 200) => Response.json(body, { status })

export default {
  async fetch(req: Request) {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return json({ error: 'GEMINI_API_KEY is not configured' }, 500)

    const body = bodySchema.safeParse(await req.json().catch(() => null))
    if (!body.success) return json({ error: z.prettifyError(body.error) }, 400)

    try {
      return json(await generateSpec(new GoogleGenAI({ apiKey }), body.data.prompt, body.data.settings))
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Generation failed' }, 502)
    }
  },
}
