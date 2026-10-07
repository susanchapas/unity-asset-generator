import { platformBudgets, type Settings } from '../spec/contracts'

interface Props {
  value: Settings
  onChange(value: Settings): void
}

const platforms = Object.keys(platformBudgets) as Settings['platform'][]
const paletteStyles: Settings['paletteStyle'][] = ['auto', 'warm', 'cool', 'pastel', 'muted']
const materialModes: { id: Settings['materialMode']; label: string }[] = [
  { id: 'texture', label: 'Texture' },
  { id: 'vertexColor', label: 'Vertex color' },
]
const maxSeed = 2 ** 31 - 1
const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1)

export function SettingsPanel({ value, onChange }: Props) {
  const set = <K extends keyof Settings>(key: K, next: Settings[K]) => onChange({ ...value, [key]: next })

  const slider = (key: 'detail' | 'roundness' | 'jitter', label: string) => (
    <div className="field">
      <label htmlFor={key}>
        {label} <output htmlFor={key}>{value[key].toFixed(2)}</output>
      </label>
      <input id={key} type="range" min={0} max={1} step={0.01} value={value[key]} onChange={(e) => set(key, e.target.valueAsNumber)} />
    </div>
  )

  const segmented = <T extends string>(
    legend: string,
    options: { id: T; label: string; hint?: string }[],
    current: T,
    onPick: (id: T) => void,
  ) => (
    <fieldset className="field">
      <legend>{legend}</legend>
      <div className="segmented">
        {options.map((option) => (
          <button key={option.id} type="button" aria-pressed={option.id === current} onClick={() => onPick(option.id)}>
            {option.label}
            {option.hint && <small>{option.hint}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  )

  return (
    <div className="panel">
      <div className="field">
        <label htmlFor="assetType">Asset type</label>
        <select id="assetType" value={value.assetType} onChange={() => set('assetType', 'prop')}>
          <option value="prop">Prop</option>
        </select>
      </div>
      {slider('detail', 'Detail')}
      {segmented(
        'Platform',
        platforms.map((id) => ({ id, label: capitalize(id), hint: `${platformBudgets[id]} tris` })),
        value.platform,
        (id) => set('platform', id),
      )}
      {slider('roundness', 'Roundness')}
      {slider('jitter', 'Jitter')}
      <div className="field">
        <label htmlFor="paletteStyle">Palette style</label>
        <select id="paletteStyle" value={value.paletteStyle} onChange={(e) => set('paletteStyle', e.target.value as Settings['paletteStyle'])}>
          {paletteStyles.map((style) => (
            <option key={style} value={style}>
              {capitalize(style)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="seed">Seed</label>
        <div className="row">
          <input
            id="seed"
            type="number"
            min={0}
            max={maxSeed}
            step={1}
            value={value.seed}
            onChange={(e) => {
              const seed = Math.trunc(e.target.valueAsNumber)
              if (Number.isFinite(seed)) set('seed', Math.min(maxSeed, Math.max(0, seed)))
            }}
          />
          <button type="button" onClick={() => set('seed', Math.floor(Math.random() * maxSeed))}>
            Randomize
          </button>
        </div>
      </div>
      {segmented('Material', materialModes, value.materialMode, (id) => set('materialMode', id))}
    </div>
  )
}
