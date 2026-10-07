import { useMemo, useState } from 'react'
import { defaultSettings, platformBudgets, type Settings } from './spec/contracts'
import { assetSpecSchema, type AssetSpec } from './spec/schema'
import { ExportBar } from './ui/ExportBar'
import { buildPlaceholder, countTriangles } from './ui/placeholder'
import { PromptBox } from './ui/PromptBox'
import { SettingsPanel } from './ui/SettingsPanel'
import { Stats } from './ui/Stats'
import { Viewport } from './ui/Viewport'

const samples = Object.entries(import.meta.glob<{ default: unknown }>('./spec/samples/*.json', { eager: true })).map(
  ([path, mod]) => ({ id: path, spec: assetSpecSchema.parse(mod.default) }),
)

async function requestSpec(_prompt: string, _settings: Settings): Promise<AssetSpec> {
  throw new Error('Gemini not connected yet')
}

export default function App() {
  const [settings, setSettings] = useState(defaultSettings)
  const [spec, setSpec] = useState<AssetSpec | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const object = useMemo(() => (spec ? buildPlaceholder(spec) : null), [spec])

  const generate = async (prompt: string) => {
    setBusy(true)
    setError(null)
    try {
      setSpec(await requestSpec(prompt, settings))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>3D Asset Generator</h1>
        <PromptBox busy={busy} error={error} onSubmit={generate} />
        <div className="panel">
          <label htmlFor="sample">Load sample</label>
          <select id="sample" value="" onChange={(e) => setSpec(samples.find((s) => s.id === e.target.value)?.spec ?? null)}>
            <option value="" disabled>
              Choose a sample…
            </option>
            {samples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.spec.name}
              </option>
            ))}
          </select>
        </div>
        <SettingsPanel value={settings} onChange={setSettings} />
      </aside>
      <main className="main">
        <Viewport object={object} />
        <footer className="footer">
          <Stats
            triangles={object ? countTriangles(object) : 0}
            budget={platformBudgets[settings.platform]}
            bytes={null}
            parts={spec?.parts.length ?? 0}
          />
          <ExportBar disabled={!object} onExportGlb={() => {}} onExportObj={() => {}} />
        </footer>
      </main>
    </div>
  )
}
