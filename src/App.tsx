import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { assetSpecSchema, type AssetSpec, type Part } from './spec/schema'
import { defaultSettings, platformBudgets, type Settings } from './spec/contracts'
import crate from './spec/samples/crate.json'
import lamp from './spec/samples/lamp.json'
import mug from './spec/samples/mug.json'
import rock from './spec/samples/rock.json'
import tree from './spec/samples/tree.json'

type SampleKey = 'crate' | 'mug' | 'tree' | 'lamp' | 'rock'
const samples: Record<SampleKey, AssetSpec> = {
  crate: assetSpecSchema.parse(crate),
  mug: assetSpecSchema.parse(mug),
  tree: assetSpecSchema.parse(tree),
  lamp: assetSpecSchema.parse(lamp),
  rock: assetSpecSchema.parse(rock),
}
const sampleNames: Record<SampleKey, string> = { crate: 'Crate', mug: 'Mug', tree: 'Pine tree', lamp: 'Floor lamp', rock: 'Boulder' }
const prompts: Record<SampleKey, string> = {
  crate: 'A sturdy wooden crate with iron braces', mug: 'A cozy ceramic coffee mug, simple and low-poly',
  tree: 'A cheerful stylized pine tree for a forest scene', lamp: 'A warm modern floor lamp with a linen shade',
  rock: 'A chunky moss-free boulder for a game level',
}
const degrees = (value: number) => (value * Math.PI) / 180

function guessSample(prompt: string): SampleKey {
  const copy = prompt.toLowerCase()
  if (/(mug|cup|coffee)/.test(copy)) return 'mug'
  if (/(tree|pine|forest)/.test(copy)) return 'tree'
  if (/(lamp|light|shade)/.test(copy)) return 'lamp'
  if (/(rock|boulder|stone)/.test(copy)) return 'rock'
  return 'crate'
}

function estimatePartTriangles(part: Part, detail: number) {
  const segments = Math.max(3, Math.round(('segments' in part ? part.segments : 8) * (0.55 + detail * 0.9)))
  if (part.primitive === 'box') return 12
  if (part.primitive === 'sphere') return segments * Math.ceil(segments / 2) * 2
  if (part.primitive === 'torus') return segments * Math.max(3, Math.floor(segments / 2)) * 2
  return segments * 4
}

function Primitive({ part, color, detail }: { part: Part; color: string; detail: number }) {
  const segments = Math.max(3, Math.round(('segments' in part ? part.segments : 8) * (0.55 + detail * 0.9)))
  const [x, y, z] = part.size
  const rotation = part.rotation.map(degrees) as [number, number, number]
  const material = <meshStandardMaterial color={color} roughness={0.74} metalness={0.04} flatShading />
  return <mesh position={part.position} rotation={rotation} castShadow receiveShadow>
    {part.primitive === 'box' && <boxGeometry args={[x, y, z]} />}
    {part.primitive === 'cylinder' && <cylinderGeometry args={[(x / 2) * part.taper, x / 2, y, segments]} />}
    {part.primitive === 'sphere' && <sphereGeometry args={[0.5, segments, Math.max(3, Math.floor(segments / 2))]} />}
    {part.primitive === 'torus' && <torusGeometry args={[0.5 - part.tube / 2, part.tube / 2, Math.max(3, Math.floor(segments / 2)), segments]} />}
    {material}
  </mesh>
}

function AssetModel({ spec, detail }: { spec: AssetSpec; detail: number }) {
  return <group>{spec.parts.map((part) => <group key={part.name} scale={part.primitive === 'sphere' || part.primitive === 'torus' ? part.size : [1, 1, 1]}>
    <Primitive part={part} color={spec.palette[part.paletteIndex]} detail={detail} />
  </group>)}</group>
}

function Preview({ spec, detail }: { spec: AssetSpec; detail: number }) {
  return <Canvas shadows camera={{ position: [4.3, 3.3, 5.2], fov: 35 }} dpr={[1, 2]}>
    <color attach="background" args={['#121b26']} /><ambientLight intensity={1.4} />
    <directionalLight position={[4, 6, 4]} intensity={2.4} castShadow /><directionalLight position={[-4, 2, -2]} intensity={0.7} color="#8eb7ff" />
    <AssetModel spec={spec} detail={detail} /><ContactShadows position={[0, -0.01, 0]} opacity={0.35} scale={8} blur={2.2} far={3.5} />
    <OrbitControls makeDefault enablePan={false} minDistance={2} maxDistance={9} target={[0, 1.1, 0]} />
  </Canvas>
}

function Control({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return <label className="control"><span>{label}{value && <em>{value}</em>}</span>{children}</label>
}

export default function App() {
  const [selected, setSelected] = useState<SampleKey>('tree')
  const [prompt, setPrompt] = useState(prompts.tree)
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [notice, setNotice] = useState('')
  const spec = samples[selected]
  const triangles = useMemo(() => spec.parts.reduce((total, part) => total + estimatePartTriangles(part, settings.detail), 0), [spec, settings.detail])
  const budget = platformBudgets[settings.platform]
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  const chooseSample = (key: SampleKey) => { setSelected(key); setPrompt(prompts[key]); setNotice('') }
  const generate = (event: FormEvent) => { event.preventDefault(); chooseSample(guessSample(prompt)); setNotice('Preview updated from the closest available sample. AI generation will replace this step.') }
  const exportSpec = () => {
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `${spec.name.toLowerCase().replaceAll(' ', '-')}.asset.json`; anchor.click(); URL.revokeObjectURL(url)
    setNotice('Asset specification downloaded.')
  }
  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">✦</span><span>FORGE<small>ASSET STUDIO</small></span></a><div className="topbar-actions"><span className="status-dot">Preview mode</span><button className="icon-button" aria-label="Open help">?</button><button className="avatar" aria-label="User menu">SC</button></div></header>
    <section className="workspace" id="top">
      <aside className="settings-panel">
        <div className="panel-heading"><span>01</span><div><p>Build settings</p><small>Shape the generation</small></div></div>
        <div className="control-group"><Control label="Asset type"><div className="segmented"><button className="active">Prop</button><button disabled>Character</button></div></Control><Control label="Platform preset"><div className="preset-grid">{(['mobile', 'desktop', 'hero'] as const).map((platform) => <button key={platform} className={settings.platform === platform ? 'selected' : ''} onClick={() => update('platform', platform)}><strong>{platform}</strong><small>{platformBudgets[platform].toLocaleString()} tris</small></button>)}</div></Control></div>
        <div className="control-group"><Control label="Detail" value={`${Math.round(settings.detail * 100)}%`}><input type="range" min="0" max="1" step="0.05" value={settings.detail} onChange={(e) => update('detail', Number(e.target.value))} /></Control><Control label="Roundness" value={`${Math.round(settings.roundness * 100)}%`}><input type="range" min="0" max="1" step="0.05" value={settings.roundness} onChange={(e) => update('roundness', Number(e.target.value))} /></Control><Control label="Surface jitter" value={`${Math.round(settings.jitter * 100)}%`}><input type="range" min="0" max="1" step="0.05" value={settings.jitter} onChange={(e) => update('jitter', Number(e.target.value))} /></Control></div>
        <div className="control-group compact-controls"><Control label="Palette"><select value={settings.paletteStyle} onChange={(e) => update('paletteStyle', e.target.value as Settings['paletteStyle'])}>{['auto', 'warm', 'cool', 'pastel', 'muted'].map((name) => <option key={name}>{name}</option>)}</select></Control><Control label="Material"><select value={settings.materialMode} onChange={(e) => update('materialMode', e.target.value as Settings['materialMode'])}><option value="texture">Palette texture</option><option value="vertexColor">Vertex color</option></select></Control><Control label="Seed"><div className="seed-row"><input type="number" min="0" max="2147483647" value={settings.seed} onChange={(e) => update('seed', Number(e.target.value))} /><button onClick={() => update('seed', Math.floor(Math.random() * 2147483647))} aria-label="Randomize seed">↻</button></div></Control></div>
      </aside>
      <section className="creator-panel"><div className="eyebrow"><span>02</span> Describe your asset</div><form onSubmit={generate} className="prompt-card"><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Asset prompt" placeholder="Describe a game-ready prop..." /><div className="prompt-footer"><span><kbd>⌘</kbd><kbd>↵</kbd> to generate</span><button type="submit" className="generate-button">Generate <b>→</b></button></div></form>{notice && <p className="notice" role="status">{notice}</p>}
        <div className="suggestions"><span>Try a sample</span>{(Object.keys(samples) as SampleKey[]).map((key) => <button key={key} className={selected === key ? 'active' : ''} onClick={() => chooseSample(key)}>{sampleNames[key]}</button>)}</div>
        <div className="preview-card"><div className="preview-toolbar"><div><span className="live-pill">● LIVE PREVIEW</span><h1>{spec.name}</h1></div><button className="view-button" onClick={() => setNotice('Drag the preview to orbit. Scroll to zoom.')}>⌘ View controls</button></div><div className="canvas-wrap"><Preview spec={spec} detail={settings.detail} /><div className="axis"><i className="axis-y">Y</i><i className="axis-x">X</i><i className="axis-z">Z</i></div><div className="canvas-hint">Drag to orbit · Scroll to zoom</div></div><div className="preview-footer"><div className="palette">{spec.palette.map((color) => <i key={color} style={{ background: color }} title={color} />)}<span>{spec.palette.length} color palette</span></div><span>Pivot: <b>{spec.pivot.replace('-', ' ')}</b></span></div></div>
      </section>
      <aside className="output-panel"><div className="panel-heading"><span>03</span><div><p>Ready for export</p><small>Unity-compatible output</small></div></div><div className="asset-summary"><div className="asset-icon">◈</div><div><strong>{spec.name}</strong><small>{spec.parts.length} parts · {settings.materialMode === 'texture' ? 'Palette texture' : 'Vertex color'}</small></div><span className="good">READY</span></div><div className="metrics"><div><span>Triangles</span><strong>{triangles.toLocaleString()}</strong><small>of {budget.toLocaleString()} budget</small><div className="meter"><i style={{ width: `${Math.min(100, (triangles / budget) * 100)}%` }} /></div></div><div><span>Est. file size</span><strong>{Math.max(2, Math.round(triangles * 0.14))} KB</strong><small>optimized geometry</small></div></div><div className="part-list"><p>PARTS <span>{spec.parts.length}</span></p>{spec.parts.map((part) => <div key={part.name}><i style={{ background: spec.palette[part.paletteIndex] }} /><span>{part.name}</span><small>{part.primitive}</small></div>)}</div><div className="export-box"><p>EXPORT FORMAT</p><div className="format-row"><button className="format active">GLB <small>Unity recommended</small></button><button className="format" onClick={exportSpec}>JSON <small>Asset specification</small></button></div><button className="export-button" onClick={() => setNotice('GLB export is ready to connect once the mesh builder is added.')}>Export .GLB <span>↓</span></button><small className="export-note">Scale 1 unit = 1 meter · Y-up</small></div></aside>
    </section>
  </main>
}
