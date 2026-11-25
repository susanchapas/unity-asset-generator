import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Grid, OrbitControls, TransformControls } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Box3, EdgesGeometry, MathUtils, Matrix4, Mesh, Sphere, Vector3, type Group, type LineSegments, type MeshStandardMaterial, type Object3D, type PerspectiveCamera } from 'three'
import { downloadBlob, exportGlb, exportObjZip, paintAsset, sanitizeFileName } from './export'
import { requestSpec } from './gemini/client'
import { buildAsset } from './geometry'
import { assetSpecSchema, type AssetSpec, type Part } from './spec/schema'
import { defaultSettings, platformBudgets, type ReferenceImage, type Settings } from './spec/contracts'
import { formatBytes } from './ui/format'
import { imageUrl, loadReferenceImage } from './ui/referenceImage'
import crate from './spec/samples/crate.json'
import lamp from './spec/samples/lamp.json'
import mug from './spec/samples/mug.json'
import rock from './spec/samples/rock.json'
import tree from './spec/samples/tree.json'
import axesIcon from './assets/icons/axes.svg'
import boxHeadingIcon from './assets/icons/box-heading.svg'
import boxSmallIcon from './assets/icons/box-small.svg'
import boxToolIcon from './assets/icons/box-tool.svg'
import brandIcon from './assets/icons/brand-box.svg'
import checkIcon from './assets/icons/check-check.svg'
import chevronIcon from './assets/icons/chevron-category.svg'
import circleIcon from './assets/icons/circle.svg'
import cubeIcon from './assets/icons/cube.svg'
import downloadIcon from './assets/icons/download.svg'
import folderIcon from './assets/icons/folder.svg'
import gridIcon from './assets/icons/grid-3x3.svg'
import handIcon from './assets/icons/hand.svg'
import imageIcon from './assets/icons/image.svg'
import keyboardIcon from './assets/icons/keyboard.svg'
import loaderIcon from './assets/icons/loader.svg'
import loaderLimeIcon from './assets/icons/loader-lime.svg'
import networkIcon from './assets/icons/network.svg'
import orbitIcon from './assets/icons/orbit.svg'
import paletteIcon from './assets/icons/palette.svg'
import rotateIcon from './assets/icons/rotate-ccw.svg'
import scanIcon from './assets/icons/scan.svg'
import shapesIcon from './assets/icons/shapes.svg'
import shuffleIcon from './assets/icons/shuffle.svg'
import slidersIcon from './assets/icons/sliders-horizontal.svg'
import sparklesDarkIcon from './assets/icons/sparkles-dark.svg'
import sparklesIcon from './assets/icons/sparkles.svg'
import zoomInIcon from './assets/icons/zoom-in.svg'
import zoomOutIcon from './assets/icons/zoom-out.svg'

type SampleKey = 'crate' | 'mug' | 'tree' | 'lamp' | 'rock'
const samples: Record<SampleKey, AssetSpec> = {
  crate: assetSpecSchema.parse(crate),
  mug: assetSpecSchema.parse(mug),
  tree: assetSpecSchema.parse(tree),
  lamp: assetSpecSchema.parse(lamp),
  rock: assetSpecSchema.parse(rock),
}
type Format = 'glb' | 'obj' | 'json'
const formats: Record<Format, string> = { glb: 'GLB', obj: 'OBJ', json: 'JSON' }
type Message = { role: 'user' | 'forma'; text: string; image?: ReferenceImage; meta?: string; error?: boolean }
type Vec3 = [number, number, number]
const views: Record<'home' | 'front' | 'side' | 'top', Vec3> = { home: [4.3, 3.3, 5.2], front: [0, 0, 1], side: [1, 0, 0], top: [0, 1, 0.001] }
type TransformMode = 'translate' | 'rotate' | 'scale'
type PartEdit = Pick<Part, 'position' | 'rotation' | 'size'>
const transformModes: [TransformMode, string][] = [['translate', 'Move'], ['rotate', 'Rotate'], ['scale', 'Scale']]
const modeKeys: Record<string, TransformMode> = { w: 'translate', e: 'rotate', r: 'scale' }
const maxSeed = 2 ** 31 - 1
const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)

function Icon({ src, size = 14 }: { src: string; size?: number }) {
  return <img src={src} width={size} height={size} alt="" />
}

type Controls = ComponentRef<typeof OrbitControls>

/** Frames the object once per mount; remount with a new key to refit. */
function Fit({ object, dir }: { object: Object3D; dir: Vec3 }) {
  const ready = useThree((state) => state.controls !== null)
  const get = useThree((state) => state.get)
  const done = useRef(false)
  useEffect(() => {
    if (!ready || done.current) return
    done.current = true
    const controls = get().controls as Controls
    const camera = controls.object as PerspectiveCamera
    const sphere = new Box3().setFromObject(object).getBoundingSphere(new Sphere())
    const distance = (sphere.radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.1
    camera.position.copy(sphere.center).addScaledVector(new Vector3(...dir).normalize(), distance)
    camera.near = distance / 100; camera.far = distance * 100; camera.updateProjectionMatrix()
    controls.target.copy(sphere.center); controls.update()
  }, [ready, get, object, dir])
  return null
}

/** Gizmo on the part's own center and axes. Drags preview on the mesh; release writes the new transform back to the spec. */
function PartEditor({ mesh, part, offset, mode, onEdit }: { mesh: Mesh; part: Part; offset: Vec3; mode: TransformMode; onEdit(edit: PartEdit): void }) {
  const proxy = useRef<Group>(null!)
  const line = useRef<LineSegments>(null!)
  const start = useRef(new Matrix4())
  const edges = useMemo(() => new EdgesGeometry(mesh.geometry, 1), [mesh])
  useLayoutEffect(() => {
    const p = proxy.current
    p.position.set(...part.position).add(new Vector3(...offset))
    p.rotation.set(...(part.rotation.map(MathUtils.degToRad) as Vec3))
    p.scale.set(1, 1, 1)
    p.updateMatrix()
    start.current.copy(p.matrix).invert()
    line.current.matrix.identity()
    line.current.matrixWorldNeedsUpdate = true
  }, [part, offset])
  const follow = () => {
    const p = proxy.current
    p.updateMatrix()
    const matrix = new Matrix4().multiplyMatrices(p.matrix, start.current)
    for (const o of [mesh, line.current]) { o.matrixAutoUpdate = false; o.matrix.copy(matrix); o.matrixWorldNeedsUpdate = true }
  }
  const commit = () => {
    const p = proxy.current
    const round = (v: number) => Math.round(v * 1000) / 1000
    onEdit({
      position: p.position.toArray().map((v, i) => round(MathUtils.clamp(v - offset[i], -10, 10))) as Vec3,
      rotation: [p.rotation.x, p.rotation.y, p.rotation.z].map((r) => round(MathUtils.radToDeg(r))) as Vec3,
      size: part.size.map((s, i) => round(MathUtils.clamp(s * Math.abs(p.scale.getComponent(i)), 0.01, 10))) as Vec3,
    })
  }
  return <>
    <group ref={proxy} />
    <lineSegments ref={line} geometry={edges} matrixAutoUpdate={false} renderOrder={1}><lineBasicMaterial color="#c3f76b" depthTest={false} transparent /></lineSegments>
    <TransformControls object={proxy} mode={mode} space={mode === 'translate' ? 'world' : 'local'} size={1.1} onObjectChange={follow} onMouseUp={commit} />
  </>
}

type StageProps = {
  object: Object3D; spec: AssetSpec; assetId: number; offset: Vec3; triangles: number; budget: number; materialLabel: string; busy: boolean
  partIndex: number | null; onSelectPart(index: number | null): void; onEditPart(index: number, edit: PartEdit): void
}

function Stage({ object, spec, assetId, offset, triangles, budget, materialLabel, busy, partIndex, onSelectPart, onEditPart }: StageProps) {
  const controls = useRef<Controls>(null)
  const down = useRef({ x: 0, y: 0 })
  const [pan, setPan] = useState(false)
  const [grid, setGrid] = useState(true)
  const [wireframe, setWireframe] = useState(false)
  const [spin, setSpin] = useState(false)
  const [mode, setMode] = useState<TransformMode>('translate')
  const [view, setViewState] = useState({ dir: views.home, n: 0 })
  const [fittedId, setFittedId] = useState(assetId)
  const setView = (dir: Vec3) => setViewState((current) => ({ dir, n: current.n + 1 }))
  if (fittedId !== assetId) { setFittedId(assetId); setView(views.home) }
  const part = partIndex === null ? null : spec.parts[partIndex]
  const mesh = partIndex === null ? undefined : object.children[partIndex]
  const editing = part !== null
  const pick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 3) return
    e.stopPropagation()
    onSelectPart(object.children.indexOf(e.object))
  }
  const miss = (e: MouseEvent) => { if (Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) < 4) onSelectPart(null) }
  const zoom = (factor: number) => {
    const c = controls.current
    if (!c) return
    c.object.position.sub(c.target).multiplyScalar(factor).add(c.target); c.update()
  }
  useEffect(() => {
    object.traverse((o) => { if (o instanceof Mesh) [o.material].flat().forEach((m: MeshStandardMaterial) => { m.wireframe = wireframe }) })
  }, [object, wireframe])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || isTyping(e.target)) return
      const key = e.key.toLowerCase()
      if (editing && key in modeKeys) setMode(modeKeys[key])
      else if (key === 'r') setView(views.home)
      else if (key === 'escape') onSelectPart(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, onSelectPart])
  return <div className="stage" onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY } }}>
    <Canvas camera={{ position: views.home, fov: 35 }} dpr={[1, 2]} onPointerMissed={miss}>
      <ambientLight intensity={1.4} /><directionalLight position={[4, 6, 4]} intensity={2.4} /><directionalLight position={[-4, 2, -2]} intensity={0.7} color="#d8f5b0" />
      <primitive object={object} onClick={pick} />
      {part && mesh instanceof Mesh && <PartEditor key={partIndex} mesh={mesh} part={part} offset={offset} mode={mode} onEdit={(edit) => onEditPart(partIndex!, edit)} />}
      <ContactShadows position={[0, -0.01, 0]} opacity={0.45} scale={8} blur={2.2} far={3.5} />
      {grid && <Grid infiniteGrid cellSize={0.5} sectionSize={2.5} cellColor="#2f3537" sectionColor="#3f4648" fadeDistance={22} />}
      <OrbitControls ref={controls} makeDefault enablePan={pan} autoRotate={spin} />
      <Fit key={view.n} object={object} dir={view.dir} />
    </Canvas>
    <div className="shading floating">
      <span className="shading-mode"><Icon src={circleIcon} size={12} />{materialLabel}</span><i className="divider" />
      <button className={`tool sm${grid ? ' on' : ''}`} onClick={() => setGrid(!grid)} aria-label="Toggle grid" aria-pressed={grid}><Icon src={gridIcon} size={16} /></button>
      <button className={`tool sm${wireframe ? ' on' : ''}`} onClick={() => setWireframe(!wireframe)} aria-label="Toggle wireframe" aria-pressed={wireframe}><Icon src={boxToolIcon} size={16} /></button>
      <span className="muted">Wireframe</span>
    </div>
    <div className="tools floating">
      <button className={`tool${pan ? '' : ' on'}`} onClick={() => setPan(false)} aria-label="Orbit" aria-pressed={!pan}><Icon src={orbitIcon} size={16} /></button>
      <button className={`tool${pan ? ' on' : ''}`} onClick={() => setPan(true)} aria-label="Pan" aria-pressed={pan}><Icon src={handIcon} size={16} /></button>
      <button className="tool" onClick={() => zoom(0.8)} aria-label="Zoom in"><Icon src={zoomInIcon} size={16} /></button>
      <button className="tool" onClick={() => zoom(1.25)} aria-label="Zoom out"><Icon src={zoomOutIcon} size={16} /></button>
      <i className="tool-divider" />
      <button className="tool" onClick={() => setView(views.home)} aria-label="Reset view"><Icon src={scanIcon} size={16} /></button>
      <button className={`tool${spin ? ' on' : ''}`} onClick={() => setSpin(!spin)} aria-label="Turntable" aria-pressed={spin}><Icon src={rotateIcon} size={16} /></button>
    </div>
    <div className="orientation">
      <Icon src={cubeIcon} size={46} />
      <div>{(['front', 'side', 'top'] as const).map((view) => <button key={view} onClick={() => setView(views[view])}>{view}</button>)}</div>
    </div>
    <div className="mesh-stats"><b className={triangles > budget ? 'bad' : ''}>{triangles.toLocaleString()} tris</b><span>{spec.parts.length} parts · {spec.palette.length} colors</span></div>
    <div className="overlay-bottom">
      {busy && <div className="progress floating">
        <div className="progress-summary"><img className="spin" src={loaderIcon} width={14} height={14} alt="" /><b>Generating asset</b><span>Gemini</span></div>
        <div className="progress-track"><i /></div>
        <small>Keep exploring the current asset while the next one generates.</small>
      </div>}
      {part && <div className="edit-bar floating">
        <b>{part.name}</b><small className="mono">{part.primitive}</small>
        <div className="segmented">{transformModes.map(([id, label]) => <button key={id} className={mode === id ? 'active' : ''} onClick={() => setMode(id)}>{label}</button>)}</div>
        <button className="done" onClick={() => onSelectPart(null)}>Done</button>
      </div>}
    </div>
    <div className="nav-hints">{(editing ? ['W  Move', 'E  Rotate', 'R  Scale', 'ESC  Deselect'] : ['CLICK  Select part', 'DRAG  Orbit', 'SCROLL  Zoom', 'R  Reset view']).map((hint) => <span key={hint}>{hint}</span>)}</div>
    <div className="axis"><img src={axesIcon} width={34} height={30} alt="" /><span>Y</span></div>
  </div>
}

function Category({ icon, title, summary, bad, open, children }: { icon: string; title: string; summary: string; bad?: boolean; open?: boolean; children: ReactNode }) {
  return <details className="category" open={open}>
    <summary><Icon src={icon} />{title}<span className={bad ? 'bad' : ''}>{summary}<Icon src={chevronIcon} size={12} /></span></summary>
    <div className="category-body">{children}</div>
  </details>
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  return <label className="param"><span>{label}</span>
    <input type="range" min="0" max="1" step="0.01" value={value} style={{ '--v': `${value * 100}%` } as CSSProperties} onChange={(e) => onChange(e.target.valueAsNumber)} />
    <output>{Math.round(value * 100)}</output>
  </label>
}

function Selector({ label, children }: { label: string; children: ReactNode }) {
  return <label className="param"><span>{label}</span>{children}</label>
}

export default function App() {
  const [selected, setSelected] = useState<SampleKey | null>('tree')
  const [spec, setSpec] = useState<AssetSpec>(samples.tree)
  const [assetId, setAssetId] = useState(0)
  const [partIndex, setPartIndex] = useState<number | null>(null)
  const [prompt, setPrompt] = useState('')
  const [image, setImage] = useState<ReferenceImage | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [format, setFormat] = useState<Format>('glb')
  const [glbSize, setGlbSize] = useState<{ object: Object3D; bytes: number } | null>(null)
  const asset = useMemo(() => buildAsset(spec, settings), [spec, settings])
  const object = useMemo(() => paintAsset(asset, spec.palette, settings.materialMode), [asset, spec.palette, settings.materialMode])
  const { triangles, budget } = asset
  const overBudget = triangles > budget
  const fileName = sanitizeFileName(spec.name)
  const bytes = glbSize?.object === object ? glbSize.bytes : null
  const materialLabel = settings.materialMode === 'texture' ? 'Palette texture' : 'Vertex color'
  useEffect(() => { exportGlb(object).then((blob) => setGlbSize({ object, bytes: blob.size }), () => {}) }, [object])
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  const loadSpec = (next: AssetSpec) => { setSpec(next); setPartIndex(null); setAssetId((n) => n + 1) }
  const chooseSample = (key: SampleKey) => { setSelected(key); loadSpec(samples[key]); setNotice('') }
  const editPart = (index: number, edit: PartEdit) => {
    setSpec((current) => ({ ...current, parts: current.parts.map((part, i) => (i === index ? { ...part, ...edit } : part)) }))
    setSelected(null)
  }
  const generate = async (event?: FormEvent) => {
    event?.preventDefault()
    const text = prompt.trim()
    if (busy || (!text && !image)) return
    const started = performance.now()
    setBusy(true); setPrompt(''); setImage(null); setNotice('')
    setMessages((current) => [...current, { role: 'user', text, image: image ?? undefined }])
    try {
      const next = await requestSpec(text, settings, image ?? undefined)
      loadSpec(next); setSelected(null)
      setMessages((current) => [...current, { role: 'forma', text: `${next.name} is ready: ${next.parts.length} parts, ${next.palette.length} colors.`, meta: `created · ${Math.round((performance.now() - started) / 1000)}s` }])
    } catch (e) {
      setMessages((current) => [...current, { role: 'forma', text: e instanceof Error ? e.message : String(e), error: true }])
    } finally { setBusy(false) }
  }
  const attach = async (file: File | undefined) => {
    if (!file) return
    try { setImage(await loadReferenceImage(file)) } catch { setNotice('Could not read that image') }
  }
  const exportAsset = async () => {
    try {
      if (format === 'glb') downloadBlob(await exportGlb(object), `${fileName}.glb`)
      else if (format === 'obj') downloadBlob(await exportObjZip(object, spec.palette, spec.name), `${fileName}.zip`)
      else downloadBlob(new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }), `${fileName}.asset.json`)
      setNotice(`${formats[format]} downloaded`)
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)) }
  }
  return <main className="app">
    <header className="appbar">
      <div className="brand"><span className="brand-mark"><Icon src={brandIcon} size={18} /></span><span className="brand-name">forma</span><span className="brand-tag">STUDIO</span></div>
      <div className="breadcrumb"><Icon src={folderIcon} /><span>Unity props</span><span>/</span><b>{spec.name}</b></div>
    </header>

    <aside className="panel create">
      <div className="panel-heading"><span className="title"><Icon src={sparklesIcon} />Create</span></div>
      <div className="conversation">
        <div className="session"><span>SESSION · {messages.filter((m) => m.role === 'user').length} PROMPTS</span></div>
        {messages.length === 0 && <div className="message forma"><span className="author"><Icon src={boxSmallIcon} size={12} />Forma</span><p>Describe a game-ready prop and I will build a low-poly mesh for Unity. Pick a sample below the preview to start from one.</p></div>}
        {messages.map((m, i) => m.role === 'user'
          ? <div key={i} className="message"><span className="author">You</span><div className="bubble">{m.image && <img className="reference" src={imageUrl(m.image)} alt="Reference" />}{m.text && <p>{m.text}</p>}</div></div>
          : <div key={i} className="message forma"><span className="author"><Icon src={boxSmallIcon} size={12} />Forma</span><p className={m.error ? 'bad' : ''}>{m.text}</p>{m.meta && <span className="receipt"><Icon src={checkIcon} size={12} />{m.meta}</span>}</div>)}
        {busy && <div className="activity"><img className="spin" src={loaderLimeIcon} width={13} height={13} alt="" />Generating your asset…</div>}
      </div>
      <form className="composer" onSubmit={generate}>
        <div className="context"><span>{settings.platform} target</span><span className="mono">{budget.toLocaleString()} TRIS</span></div>
        <div className="prompt-input">
          {image && <div className="attachment"><img src={imageUrl(image)} alt="Reference" /><button type="button" onClick={() => setImage(null)} aria-label="Remove reference image">×</button></div>}
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate() }} aria-label="Asset prompt" placeholder={image ? 'Describe the prop in the image (optional)…' : 'Describe a game-ready prop…'} />
          <div className="prompt-actions">
            <label className="icon-button" aria-label="Attach reference image" title="Attach reference image"><Icon src={imageIcon} size={14} /><input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { attach(e.target.files?.[0]); e.target.value = '' }} /></label>
            <span className="mono">⌘ ↵</span>
          </div>
        </div>
        <button type="submit" className="primary" disabled={busy || (!prompt.trim() && !image)}><Icon src={sparklesDarkIcon} size={16} />{busy ? 'Generating…' : 'Generate asset'}</button>
        <div className="cost mono"><span>Seed {settings.seed}</span><span>{settings.paletteStyle} palette</span></div>
      </form>
    </aside>

    <section className="preview">
      <div className="preview-heading">
        <span className="title"><Icon src={boxHeadingIcon} />{spec.name}<small className="mono">{fileName}.glb</small></span>
        <span className="tab">3D preview</span>
      </div>
      <Stage object={object} spec={spec} assetId={assetId} offset={asset.pivotOffset} triangles={triangles} budget={budget} materialLabel={materialLabel} busy={busy} partIndex={partIndex} onSelectPart={setPartIndex} onEditPart={editPart} />
      <div className="samples">
        <div className="samples-heading"><b>Samples</b><span className="mono">{String(Object.keys(samples).length).padStart(2, '0')}</span></div>
        <div className="sample-row">{(Object.keys(samples) as SampleKey[]).map((key) => {
          const sample = samples[key]
          return <button key={key} className={`sample${selected === key ? ' current' : ''}`} onClick={() => chooseSample(key)}>
            <span className="thumb">{sample.palette.slice(0, 4).map((color) => <i key={color} style={{ background: color }} />)}</span>
            <span className="sample-details"><span className="mono">{sample.parts.length} PARTS{selected === key && <small>LOADED</small>}</span><b>{sample.name}</b><small className="mono">{sample.palette.length} colors · {sample.pivot}</small></span>
          </button>
        })}</div>
      </div>
    </section>

    <aside className="panel inspector">
      <div className="panel-heading"><span className="title">Asset inspector</span><span className="mono">{settings.platform.toUpperCase()} PRESET</span></div>
      <div className="inspector-scroll">
        <div className="asset-type"><span className="mono">ASSET TYPE</span><div className="segmented"><button className="active">Prop</button><button disabled>Character</button></div></div>
        <Category icon={shapesIcon} title="Shape & style" summary="CUSTOM" open>
          <Slider label="Detail" value={settings.detail} onChange={(v) => update('detail', v)} />
          <Slider label="Roundness" value={settings.roundness} onChange={(v) => update('roundness', v)} />
          <Slider label="Surface jitter" value={settings.jitter} onChange={(v) => update('jitter', v)} />
          <Selector label="Platform"><select value={settings.platform} onChange={(e) => update('platform', e.target.value as Settings['platform'])}>{(Object.keys(platformBudgets) as Settings['platform'][]).map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)} · {platformBudgets[p].toLocaleString()} tris</option>)}</select></Selector>
        </Category>
        <Category icon={paletteIcon} title="Palette & textures" summary={materialLabel.toUpperCase()} open>
          <div className="swatches">{spec.palette.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div>
          <Selector label="Palette style"><select value={settings.paletteStyle} onChange={(e) => update('paletteStyle', e.target.value as Settings['paletteStyle'])}>{['auto', 'warm', 'cool', 'pastel', 'muted'].map((name) => <option key={name}>{name}</option>)}</select></Selector>
          <Selector label="Material"><select value={settings.materialMode} onChange={(e) => update('materialMode', e.target.value as Settings['materialMode'])}><option value="texture">Palette texture</option><option value="vertexColor">Vertex color</option></select></Selector>
        </Category>
        <Category icon={networkIcon} title="Geometry & topology" summary={`${triangles.toLocaleString()} / ${budget.toLocaleString()}`} bad={overBudget}>
          <div className="meter"><i className={overBudget ? 'bad' : ''} style={{ width: `${Math.min(100, (triangles / budget) * 100)}%` }} /></div>
          <div className="parts">{spec.parts.map((part, i) => <button key={part.name} className={partIndex === i ? 'active' : ''} onClick={() => setPartIndex(partIndex === i ? null : i)}><i style={{ background: spec.palette[part.paletteIndex] }} /><span>{part.name}</span><small className="mono">{part.primitive}</small></button>)}</div>
        </Category>
        <Category icon={slidersIcon} title="Generation" summary={`SEED ${settings.seed}`}>
          <div className="param"><span>Seed</span>
            <label className="numeric"><small>SEED</small><input type="number" min="0" max={maxSeed} value={settings.seed} onChange={(e) => { const seed = Math.trunc(e.target.valueAsNumber); if (Number.isFinite(seed)) update('seed', Math.min(maxSeed, Math.max(0, seed))) }} /></label>
            <button className="icon-button" onClick={() => update('seed', Math.floor(Math.random() * maxSeed))} aria-label="Randomize seed"><Icon src={shuffleIcon} size={13} /></button>
          </div>
        </Category>
      </div>
      <div className="export">
        <div className="export-heading"><b>Export asset</b><span className="mono">SCALE 1.0 · METERS · Y-UP</span></div>
        <div className="segmented">{(Object.keys(formats) as Format[]).map((key) => <button key={key} className={format === key ? 'active' : ''} onClick={() => setFormat(key)}>{formats[key]}</button>)}</div>
        <div className="export-meta mono"><span>Est. GLB {formatBytes(bytes)}</span><span>{format === 'obj' ? 'ZIP · OBJ + MTL + PNG' : format === 'json' ? 'ASSET SPEC' : 'UNITY RECOMMENDED'}</span></div>
        <button className="secondary" onClick={exportAsset}><Icon src={downloadIcon} size={16} />Export {spec.name}</button>
      </div>
    </aside>

    <footer className="statusbar mono">
      <span className="engine"><i className={busy ? 'busy' : ''} />{busy ? 'GENERATING' : 'ENGINE ONLINE'}<b>Gemini</b></span>
      <span role="status">{notice || 'Settings apply live · Your current asset stays intact'}</span>
      <span className="help"><Icon src={keyboardIcon} size={12} />⌘↵ Generate · R Reset view</span>
    </footer>
  </main>
}
