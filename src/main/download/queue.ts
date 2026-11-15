import fs from 'node:fs/promises'
import path from 'node:path'

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>

export class DownloadHttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'DownloadHttpError'
  }
}

export interface DownloadOptions {
  headers?: Record<string, string>
  signal: AbortSignal
  onProgress?: (received: number, total: number | null) => void
}

export interface DownloadResult {
  bytes: number
  contentType: string | null
}

export async function downloadToFile(
  fetchFn: FetchFn,
  url: string,
  destination: string,
  options: DownloadOptions
): Promise<DownloadResult> {
  await fs.mkdir(path.dirname(destination), { recursive: true })

  const response = await fetchFn(url, {
    method: 'GET',
    credentials: 'include',
    redirect: 'follow',
    signal: options.signal,
    headers: {
      Accept: 'image/jpeg,image/png,image/gif,image/*;q=0.9,video/*,*/*;q=0.8',
      Referer: 'https://www.reddit.com/',
      ...options.headers
    }
  })

  if (!response.ok || !response.body) {
    const snippet = (await response.text().catch(() => '')).slice(0, 200)
    throw new DownloadHttpError(
      response.status,
      `HTTP ${response.status} ${response.statusText}${snippet ? ` – ${snippet}` : ''}`
    )
  }

  const totalHeader = Number(response.headers.get('content-length'))
  const total = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : null
  const temp = `${destination}.part`
  const handle = await fs.open(temp, 'w')
  const reader = response.body.getReader()
  let received = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const buffer = Buffer.from(value)
      await handle.write(buffer)
      received += buffer.length
      options.onProgress?.(received, total)
    }
    await handle.close()
    await fs.rename(temp, destination)
    return { bytes: received, contentType: response.headers.get('content-type') }
  } catch (err) {
    await handle.close().catch(() => undefined)
    await fs.unlink(temp).catch(() => undefined)
    throw err
  }
}

export async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0
  const size = Math.max(1, Math.min(concurrency, items.length))
  const runners = Array.from({ length: size }, async () => {
    while (true) {
      const index = next++
      if (index >= items.length) return
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

export async function uniqueDestination(
  destination: string,
  reserved: Set<string>
): Promise<string> {
  const dir = path.dirname(destination)
  const ext = path.extname(destination)
  const base = path.basename(destination, ext)

  for (let i = 0; i < 1000; i++) {
    const candidate = i === 0 ? destination : path.join(dir, `${base} (${i})${ext}`)
    if (reserved.has(candidate)) continue

    // Reserve before awaiting so two workers cannot claim the same name.
    reserved.add(candidate)
    try {
      await fs.access(candidate)
    } catch (err: any) {
      // Only ENOENT means the name is free. Other errors (permissions, etc.)
      // should not reserve a name that might be usable later.
      if (err?.code === 'ENOENT') return candidate
      reserved.delete(candidate)
      throw err
    }
    // The file exists; this candidate is taken.
    reserved.delete(candidate)
  }

  throw new Error(`Could not find a free filename for ${destination}`)
}
