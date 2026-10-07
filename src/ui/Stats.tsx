import { formatBytes } from './format'

interface Props {
  triangles: number
  budget: number
  bytes: number | null
  parts: number
}

export function Stats({ triangles, budget, bytes, parts }: Props) {
  const over = triangles > budget
  return (
    <dl className="stats">
      <div className={over ? 'over' : undefined}>
        <dt>Triangles</dt>
        <dd>
          {triangles} / {budget}
          {over && <small> over budget</small>}
        </dd>
      </div>
      <div>
        <dt>File size</dt>
        <dd>{formatBytes(bytes)}</dd>
      </div>
      <div>
        <dt>Parts</dt>
        <dd>{parts}</dd>
      </div>
    </dl>
  )
}
