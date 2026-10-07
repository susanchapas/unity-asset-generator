interface Props {
  disabled: boolean
  onExportGlb(): void
  onExportObj(): void
}

export function ExportBar({ disabled, onExportGlb, onExportObj }: Props) {
  return (
    <div className="row">
      <button type="button" disabled={disabled} onClick={onExportGlb}>
        Download GLB
      </button>
      <button type="button" disabled={disabled} onClick={onExportObj}>
        Download OBJ (zip)
      </button>
    </div>
  )
}
