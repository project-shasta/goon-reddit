export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`
}

export function formatSpeed(bps: number | null | undefined): string {
  if (bps === null || bps === undefined || !Number.isFinite(bps) || bps <= 0) return ''
  return `${formatBytes(bps)}/s`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value)
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return ''
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

export function downloadPercent(download: {
  receivedBytes: number
  totalBytes: number | null
  ratio: number | null
}): number | null {
  if (download.ratio !== null && Number.isFinite(download.ratio)) {
    return Math.max(0, Math.min(100, download.ratio * 100))
  }
  if (download.totalBytes && download.totalBytes > 0) {
    return Math.max(0, Math.min(100, (download.receivedBytes / download.totalBytes) * 100))
  }
  return null
}

export function errorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw
    .replace(/^Error invoking remote method '[^']+': Error: /, '')
    .replace(/^Error: /, '')
    .trim()
}

export function timeAgo(utcSeconds: number): string {
  if (!utcSeconds) return ''
  const diff = Date.now() / 1000 - utcSeconds
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  return new Date(utcSeconds * 1000).toLocaleDateString()
}
