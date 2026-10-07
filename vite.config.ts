import { Readable } from 'node:stream'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

function apiDev(): Plugin {
  return {
    name: 'api-dev',
    configureServer(server) {
      process.env.GEMINI_API_KEY ??= loadEnv(server.config.mode, server.config.envDir || server.config.root, '').GEMINI_API_KEY
      server.middlewares.use('/api/generate', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/api/generate.ts')
        const request = new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method === 'POST' ? (Readable.toWeb(req) as ReadableStream) : undefined,
          duplex: 'half',
        } as RequestInit)
        const response: Response = await handler.fetch(request)
        res.statusCode = response.status
        res.setHeader('Content-Type', 'application/json')
        res.end(await response.text())
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiDev()],
})
