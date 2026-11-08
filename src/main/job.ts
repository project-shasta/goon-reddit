import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import type {
  ActiveDownload,
  JobOptions,
  JobState,
  MediaItem,
  SubredditInfo
} from '@shared/types'
import { safeFilename } from '@shared/filename'
import type { AuthManager } from './auth'
import type { SettingsStore } from './settings'
import type { ToolManager } from './tooling'
import { allowMediaRoot } from './mediaProtocol'
import { extractMedia } from './reddit/extract'
import { errorMessage, isRedditError } from './reddit/errors'
import { sleep } from './reddit/client'
import { validateSubreddit } from './reddit/validate'
import { downloadToFile, runPool, uniqueDestination } from './download/queue'
import { downloadWithFfmpeg } from './download/ffmpeg'
import { downloadWithYtDlp } from './download/ytdlp'

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface JobDeps {
  auth: AuthManager
  settings: SettingsStore
  tools: ToolManager
  emitState: (state: JobState) => void
  emitMedia: (items: MediaItem[]) => void
  emitMediaUpdate: (item: MediaItem) => void
  log: (level: LogLevel, message: string) => void
}

function initialState(): JobState {
  return {
    phase: 'idle',
    mode: 'download',
    subreddit: null,
    scannedPosts: 0,
    discovered: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    active: [],
    message: null,
    startedAt: null,
    finishedAt: null
  }
}

/** File-size thresholds below which an image is likely a thumbnail. */
const THUMBNAIL_BYTES: Record<string, number> = {
  jpg: 12_000,
  jpeg: 12_000,
  png: 8_000,
  webp: 8_000
}

/** Check if a downloaded image file is likely a thumbnail (too small). */
function isThumbnailFile(filePath: string, ext: string): boolean {
  const threshold = THUMBNAIL_BYTES[ext.toLowerCase()]
  if (threshold === undefined) return false
  try {
    const size = fs.statSync(filePath).size
    return size < threshold
  } catch {
    return false
  }
}

export class JobRunner {
  private state: JobState = initialState()
  private controller: AbortController | null = null
  private running = false

  /** Track scan state for re-scanning when thumbnails are skipped. */
  private postsScanned = 0
  private scannedPostIds = new Set<string>()

  constructor(private readonly deps: JobDeps) {}

  getState(): JobState {
    return { ...this.state, active: [...this.state.active] }
  }

  isRunning(): boolean {
    return this.running
  }

  private emit(): void {
    this.deps.emitState(this.getState())
  }

  private setPhase(phase: JobState['phase'], message: string | null = null): void {
    this.state.phase = phase
    this.state.message = message
    this.emit()
  }

  cancel(): void {
    if (!this.running) return
    this.state.message = 'Cancelling…'
    this.emit()
    this.controller?.abort()
  }

  async start(options: JobOptions): Promise<void> {
    if (this.running) throw new Error('A job is already running.')

    const includeAny =
      options.includeImages ||
      options.includeGalleries ||
      options.includeVideos ||
      options.includeExternalVideos
    if (!includeAny) throw new Error('Enable at least one media type.')

    const destination = path.resolve(options.destination)
    const controller = new AbortController()
    this.controller = controller
    this.running = true
    this.state = {
      ...initialState(),
      startedAt: Date.now()
    }
    this.setPhase('validating')
    allowMediaRoot(destination)

    try {
      const auth = await this.deps.auth.refresh(false)
      if (!auth.loggedIn) {
        throw new Error(
          auth.message ?? 'Log in on Reddit before starting. Reddit now requires a logged-in session.'
        )
      }

      const subreddit = await validateSubreddit(
        this.deps.auth.client,
        options.subreddit,
        controller.signal
      )
      this.state.subreddit = subreddit
      this.deps.log(
        'info',
        `r/${subreddit.name} — ${subreddit.subscribers?.toLocaleString() ?? '?'} members${
          subreddit.over18 ? ' — NSFW' : ''
        }`
      )
      if (subreddit.quarantined) {
        this.deps.log('warn', 'This subreddit is quarantined; it may require opt-in on Reddit.')
      }

      await fsp.mkdir(path.join(destination, safeFilename(subreddit.name)), { recursive: true })

      const media = await this.scan(subreddit, options, destination, controller.signal)
      const prioritized = this.prioritizeLargeImages(media)

      if (prioritized.length === 0) {
        this.state.finishedAt = Date.now()
        this.setPhase('done', 'No downloadable media found in the scanned posts.')
        return
      }

      await this.downloadAll(prioritized, subreddit, options, destination, controller.signal)

      this.state.finishedAt = Date.now()
      const summary = `Downloaded ${this.state.completed} file${
        this.state.completed === 1 ? '' : 's'
      }${this.state.skipped ? `, skipped ${this.state.skipped}` : ''}${
        this.state.failed ? `, ${this.state.failed} failed` : ''
      }.`

      if (controller.signal.aborted) {
        this.setPhase('cancelled', `Cancelled. ${summary}`)
      } else {
        this.setPhase('done', summary)
      }
      this.deps.log(controller.signal.aborted ? 'warn' : 'success', summary)
    } catch (err) {
      this.state.finishedAt = Date.now()
      if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        this.setPhase('cancelled', 'Cancelled.')
      } else {
        const message = errorMessage(err)
        this.setPhase('error', message)
        this.deps.log('error', message)
        if (isRedditError(err) && err.code === 'AUTH_REQUIRED') {
          this.deps.log('warn', 'Open the Reddit login window to refresh your session.')
        }
      }
    } finally {
      this.running = false
      this.controller = null
      if (this.state.phase !== 'done' && this.state.phase !== 'error') this.emit()
    }
  }

  private extractOptions(options: JobOptions) {
    return {
      includeImages: options.includeImages,
      includeGalleries: options.includeGalleries,
      includeVideos: options.includeVideos,
      includeExternalVideos: options.includeExternalVideos,
      skipNsfw: options.skipNsfw
    }
  }

  private async scan(
    subreddit: SubredditInfo,
    options: JobOptions,
    destination: string,
    signal: AbortSignal
  ): Promise<MediaItem[]> {
    this.setPhase('scanning')
    const media: MediaItem[] = []
    const seen = new Set<string>()
    const seenFiles = new Set<string>()
    const maxPosts = options.maxPosts > 0 ? options.maxPosts : Number.POSITIVE_INFINITY
    const folder = path.join(destination, safeFilename(subreddit.name))
    let scanned = 0
    this.postsScanned = 0
    this.scannedPostIds = new Set<string>()

    for await (const page of this.deps.auth.client.pages(subreddit.name, { signal })) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const batch: MediaItem[] = []

      for (const post of page.posts) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        if (scanned >= maxPosts) break
        scanned++
        this.postsScanned++
        this.scannedPostIds.add(post.id)

        const extracted = extractMedia(post, this.extractOptions(options))
        for (const item of extracted) {
          if (seen.has(item.id)) continue
          seen.add(item.id)

          item.filename = safeFilename(item.filename)
          const initialPath = path.join(folder, item.filename)

          if (seenFiles.has(initialPath) && options.skipExisting) continue
          seenFiles.add(initialPath)

          if (options.skipExisting && fs.existsSync(initialPath)) {
            item.localPath = initialPath
          }

          media.push(item)
          batch.push(item)
        }
      }

      this.state.scannedPosts = scanned
      this.state.discovered = media.length
      this.emit()
      if (batch.length > 0) this.deps.emitMedia(batch)
      if (scanned >= maxPosts) break
    }

    this.state.scannedPosts = this.postsScanned
    this.state.discovered = media.length
    this.emit()
    return media
  }

  /** Sort images so large ones download first; small/thumbnail images go to the end. */
  private prioritizeLargeImages(media: MediaItem[]): MediaItem[] {
    const THUMBNAIL_MAX = 700
    return [...media].sort((a, b) => {
      const aLarge = (a.width ?? 0) >= THUMBNAIL_MAX && (a.height ?? 0) >= THUMBNAIL_MAX
      const bLarge = (b.width ?? 0) >= THUMBNAIL_MAX && (b.height ?? 0) >= THUMBNAIL_MAX
      if (aLarge === bLarge) return 0
      return aLarge ? -1 : 1
    })
  }

  /** Fetch the next page of posts beyond what was initially scanned. */
  private async fetchNextPosts(
    subreddit: SubredditInfo,
    signal: AbortSignal
  ): Promise<{ posts: MediaItem[] }> {
    const folder = path.join(
      this.state.subreddit
        ? path.resolve(this.deps.settings.get().destination, safeFilename(subreddit.name))
        : '',
      safeFilename(subreddit.name)
    )
    const posts: MediaItem[] = []
    const seen = new Set(this.scannedPostIds)

    for await (const page of this.deps.auth.client.pages(subreddit.name, { signal })) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

      for (const post of page.posts) {
        if (seen.has(post.id)) continue
        seen.add(post.id)

        const extracted = extractMedia(post, this.extractOptions({
          subreddit: '',
          destination: '',
          mode: 'download',
          maxPosts: 0,
          concurrency: 1,
          includeImages: true,
          includeGalleries: true,
          includeVideos: false,
          includeExternalVideos: false,
          skipNsfw: false,
          skipExisting: false
        }))
        for (const item of extracted) {
          item.filename = safeFilename(item.filename)
          const initialPath = path.join(folder, item.filename)
          if (!fs.existsSync(initialPath)) {
            posts.push(item)
          }
        }
      }
    }

    // Update scan tracking
    for (const id of seen) {
      if (!this.scannedPostIds.has(id)) {
        this.scannedPostIds.add(id)
        this.postsScanned++
      }
    }

    return { posts }
  }

  private async downloadAll(
    media: MediaItem[],
    subreddit: SubredditInfo,
    options: JobOptions,
    destination: string,
    signal: AbortSignal
  ): Promise<void> {
    this.setPhase('downloading')
    const folder = path.join(destination, safeFilename(subreddit.name))
    const reserved = new Set<string>()

    await runPool(media, options.concurrency, async (item) => {
      if (signal.aborted) return
      await this.downloadItem(item, folder, options.skipExisting, reserved, signal)
    })
  }

  private activeEntry(item: MediaItem, filename: string): ActiveDownload {
    return {
      id: item.id,
      filename,
      status: 'queued',
      receivedBytes: 0,
      totalBytes: null,
      ratio: null,
      speedBps: null
    }
  }

  private pushActive(entry: ActiveDownload): void {
    this.state.active = [entry, ...this.state.active.filter((a) => a.id !== entry.id)].slice(0, 60)
  }

  private async downloadItem(
    item: MediaItem,
    folder: string,
    skipExisting: boolean,
    reserved: Set<string>,
    signal: AbortSignal
  ): Promise<void> {
    const initialPath = path.join(folder, item.filename)

    if (skipExisting && fs.existsSync(initialPath)) {
      item.localPath = initialPath
      this.state.skipped++
      this.deps.emitMediaUpdate({ ...item })
      this.emit()
      return
    }

    let destination: string
    try {
      destination = await uniqueDestination(initialPath, reserved)
    } catch (err) {
      this.state.failed++
      this.deps.log('error', `${item.filename}: ${errorMessage(err)}`)
      this.emit()
      return
    }

    const entry = this.activeEntry(item, path.basename(destination))
    this.pushActive(entry)
    this.emit()

    let lastEmit = 0
    let lastBytes = 0
    let lastTime = Date.now()

    const tick = (received: number, total: number | null, ratio: number | null, force = false): void => {
      entry.receivedBytes = received
      entry.totalBytes = total
      entry.ratio = ratio
      const now = Date.now()
      const elapsed = (now - lastTime) / 1000
      if (elapsed > 0.25 && received >= lastBytes) {
        entry.speedBps = (received - lastBytes) / elapsed
        lastBytes = received
        lastTime = now
      }
      if (force || now - lastEmit > 200) {
        lastEmit = now
        this.emit()
      }
    }

    try {
      if (item.kind === 'video') {
        entry.status = 'processing'
        this.emit()
        await this.downloadRedditVideo(item, destination, signal, (ratio) => {
          tick(ratio === null ? 0 : Math.round(ratio * 1000), ratio === null ? null : 1000, ratio)
        })
      } else if (item.kind === 'external-video') {
        entry.status = 'processing'
        this.emit()
        const resolved = await this.downloadExternalVideo(item, destination, signal, (received, total) =>
          tick(received, total, total ? received / total : null)
        )
        item.localPath = resolved.path
        item.filename = path.basename(resolved.path)
        item.ext = path.extname(resolved.path).replace(/^\./, '') || item.ext
        entry.filename = item.filename
      } else {
        entry.status = 'downloading'
        this.emit()
        const result = await this.downloadImage(item, destination, signal, (received, total) =>
          tick(received, total, total ? received / total : null)
        )
        if ('skipped' in result) {
          this.state.skipped++
          this.deps.log('warn', `Skipped ${item.filename}`)
          this.emit()
          return
        }

        // Check if the downloaded image is still a thumbnail.
        if (item.kind === 'image' || item.kind === 'gallery' || item.kind === 'external-image') {
          if (isThumbnailFile(destination, item.ext)) {
            this.state.skipped++
            this.deps.log('warn', `Skipped ${item.filename}: still a thumbnail after retries`)
            this.emit()
            // Try to fetch replacement posts.
            await this.tryReplaceThumbnail(item, folder, signal)
            return
          }
        }

        item.localPath = destination
        entry.receivedBytes = result.bytes
      }

      if (item.kind !== 'external-video') item.localPath = destination
      entry.status = 'done'
      entry.ratio = 1
      this.state.completed++
      this.deps.emitMediaUpdate({ ...item })
      this.deps.log('success', `Saved ${path.basename(item.localPath ?? destination)}`)
      tick(entry.receivedBytes, entry.totalBytes, 1, true)
    } catch (err) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        entry.status = 'cancelled'
        this.emit()
      } else {
        entry.status = 'failed'
        entry.error = errorMessage(err)
        this.state.failed++
        this.deps.log('error', `${item.filename}: ${errorMessage(err)}`)
        this.emit()
      }
    } finally {
      // Keep the finished file; remove anything left behind by a failed or
      // cancelled transfer.
      if (entry.status !== 'done') {
        await fsp.unlink(`${destination}.part`).catch(() => undefined)
        await fsp.unlink(`${destination}.part.mp4`).catch(() => undefined)
        await fsp.unlink(destination).catch(() => undefined)
      }
    }
  }

  /** When a thumbnail is skipped, try to fetch replacement posts. */
  private async tryReplaceThumbnail(
    _item: MediaItem,
    _folder: string,
    signal: AbortSignal
  ): Promise<void> {
    const subreddit = this.state.subreddit
    if (!subreddit) return

    const maxPosts = this.deps.settings.get().maxPosts
    if (this.postsScanned >= maxPosts) {
      // Already scanned all allowed posts — nothing left to replace with.
      return
    }

    try {
      const { posts } = await this.fetchNextPosts(subreddit, signal)
      if (posts.length > 0) {
        this.deps.emitMedia(posts)
        this.state.discovered += posts.length
        this.emit()
        this.deps.log('info', `Replaced thumbnail: found ${posts.length} new media from next posts.`)
      }
    } catch {
      // If fetching fails, just silently skip — don't break the download.
    }
  }

  private async downloadImage(
    item: MediaItem,
    destination: string,
    signal: AbortSignal,
    onProgress: (received: number, total: number | null) => void
  ): Promise<{ bytes: number } | { skipped: true }> {
    const fetchFn = this.deps.auth.session.fetch.bind(this.deps.auth.session)
    const maxRetries = 3

    // Try the primary URL up to maxRetries times.
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await downloadToFile(fetchFn, item.sourceUrl, destination, { signal, onProgress })
      } catch (err) {
        if (signal.aborted) throw err
        if (attempt < maxRetries - 1) {
          this.deps.log('warn', `Retrying ${item.filename} (attempt ${attempt + 2}/${maxRetries})`)
          await sleep(800 + Math.random() * 400, signal)
        }
      }
    }

    // Fallback to the preview/thumbnail URL, also retrying up to maxRetries times.
    if (item.previewUrl && item.previewUrl !== item.sourceUrl) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          this.deps.log('warn', `Retrying ${item.filename} with preview URL (attempt ${attempt + 1}/${maxRetries})`)
          return await downloadToFile(fetchFn, item.previewUrl, destination, { signal, onProgress })
        } catch (err) {
          if (signal.aborted) throw err
          if (attempt < maxRetries - 1) {
            await sleep(800 + Math.random() * 400, signal)
          }
        }
      }
    }

    // All retries exhausted — skip this item instead of failing the whole job.
    this.deps.log('warn', `Skipping ${item.filename}: could not fetch after ${maxRetries} attempts`)
    return { skipped: true }
  }

  private async downloadRedditVideo(
    item: MediaItem,
    destination: string,
    signal: AbortSignal,
    onProgress: (ratio: number | null) => void
  ): Promise<void> {
    const ffmpeg = this.deps.tools.ffmpegPath()
    const alternates = item.videoAlternates ?? {}
    const attempts: Array<{ kind: 'ffmpeg' | 'http'; url: string; label: string }> = []

    if (alternates.dash) attempts.push({ kind: 'ffmpeg', url: alternates.dash, label: 'DASH' })
    if (alternates.hls) attempts.push({ kind: 'ffmpeg', url: alternates.hls, label: 'HLS' })
    if (alternates.fallback) {
      attempts.push({ kind: 'http', url: alternates.fallback, label: 'fallback' })
    }
    if (attempts.length === 0) {
      attempts.push({
        kind: item.videoStrategy === 'fallback' ? 'http' : 'ffmpeg',
        url: item.sourceUrl,
        label: item.videoStrategy ?? 'video'
      })
    }

    let lastError: unknown = null
    for (const attempt of attempts) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      try {
        if (attempt.kind === 'ffmpeg') {
          if (!ffmpeg) {
            lastError = new Error('ffmpeg is missing from the tools folder.')
            continue
          }
          this.deps.log('info', `Merging ${attempt.label} stream for ${item.filename}`)
          await downloadWithFfmpeg(ffmpeg, attempt.url, destination, {
            duration: item.duration,
            signal,
            onProgress
          })
        } else {
          this.deps.log('warn', `Falling back to video-only ${attempt.label} download for ${item.filename}`)
          const fetchFn = this.deps.auth.session.fetch.bind(this.deps.auth.session)
          await downloadToFile(fetchFn, attempt.url, destination, {
            signal,
            onProgress: (received, total) => onProgress(total ? received / total : null)
          })
        }
        return
      } catch (err) {
        if (signal.aborted) throw err
        lastError = err
        this.deps.log('warn', `${attempt.label} failed for ${item.filename}: ${errorMessage(err)}`)
      }
    }

    throw lastError instanceof Error ? lastError : new Error('All video download strategies failed.')
  }

  private async downloadExternalVideo(
    item: MediaItem,
    destination: string,
    signal: AbortSignal,
    onProgress: (received: number, total: number | null) => void
  ): Promise<{ path: string; bytes: number }> {
    const ytdlp = this.deps.tools.ytdlpPath()
    if (!ytdlp) {
      throw new Error(
        'yt-dlp is missing from the tools folder. Use Settings → Tools → Update yt-dlp, then retry.'
      )
    }
    const outBase = destination.replace(/\.[^.]+$/, '')
    return downloadWithYtDlp(ytdlp, item.sourceUrl, outBase, {
      ffmpegPath: this.deps.tools.ffmpegPath(),
      signal,
      onProgress
    })
  }
}
