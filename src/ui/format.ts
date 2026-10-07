export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  return `${(bytes / 1024).toFixed(1)} KB`
}
