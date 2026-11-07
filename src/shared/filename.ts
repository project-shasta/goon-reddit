const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** Slugify a Reddit post title for use in a Windows-safe filename. */
export function slugifyTitle(title: string, maxLength = 60): string {
  const cleaned = title
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  if (!cleaned) return 'untitled'
  return cleaned.slice(0, maxLength).replace(/-+$/g, '') || 'untitled'
}

export function safeFilename(name: string, maxLength = 120): string {
  let out = name
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')

  if (!out) out = 'untitled'
  // Windows reserves device names even when an extension follows them.
  const stem = out.split('.', 1)[0]
  if (WINDOWS_RESERVED.test(stem)) out = `_${out}`
  if (out.length > maxLength) {
    const dot = out.lastIndexOf('.')
    const ext = dot > 0 && out.length - dot <= 10 ? out.slice(dot) : ''
    const base = ext ? out.slice(0, dot) : out
    out = base.slice(0, Math.max(1, maxLength - ext.length)).replace(/[. ]+$/g, '') + ext
  }
  return out
}

export function formatDate(utcSeconds: number): string {
  const d = new Date(utcSeconds * 1000)
  if (Number.isNaN(d.getTime())) return '1970-01-01'
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function buildFilename(opts: {
  postId: string
  title: string
  createdUtc: number
  ext: string
  index?: number
  total?: number
}): string {
  const date = formatDate(opts.createdUtc)
  const slug = slugifyTitle(opts.title)
  const index =
    opts.total !== undefined && opts.total > 1
      ? `_${String((opts.index ?? 0) + 1).padStart(2, '0')}`
      : ''
  const ext = opts.ext.replace(/^\./, '').toLowerCase() || 'jpg'
  return safeFilename(`${date}_${opts.postId}_${slug}${index}.${ext}`)
}

export function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname
    const match = /\.([a-z0-9]{2,5})$/i.exec(pathname)
    if (!match) return null
    const ext = match[1].toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'mkv', 'm4v'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext
    }
    return null
  } catch {
    return null
  }
}

export function extensionFromMime(mime: string | undefined | null): string | null {
  if (!mime) return null
  const m = mime.toLowerCase().split(';')[0].trim()
  switch (m) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/gif':
      return 'gif'
    case 'image/webp':
      return 'webp'
    case 'image/avif':
      return 'avif'
    case 'video/mp4':
      return 'mp4'
    case 'video/webm':
      return 'webm'
    default:
      return null
  }
}
