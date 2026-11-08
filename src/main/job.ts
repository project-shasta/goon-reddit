import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import type {
  ActiveDownload,
  JobOptions,
  JobState,
  MediaItem,
  SubredditInfo,
  UserInfo
} from '@shared/types'
import { safeFilename } from '@shared/filename'
import type { AuthManager } from './auth'
import type { SettingsStore } from './settings'
import type { ToolManager } from './tooling'
import { allowMediaRoot } from './mediaProtocol'
import { extractMedia } from './reddit/extract'
import { errorMessage, isRedditError } from './reddit/errors'
import { sleep } from './reddit/client'
import { validateSubreddit, validateUser } from './reddit/validate'
import { downloadToFile, runPool, uniqueDestination } from './download/queue'
import { downloadWithFfmpeg } from './download/ffmpeg'
import { downloadWithYtDlp } from './download/ytdlp'
import { HistoryStore } from './history'

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface JobDeps {
  auth: AuthManager
  settings: SettingsStore
  history: HistoryStore
  tools: ToolManager
  emitState: (state: JobState) => void
  emitMedia: (items: MediaItem[]) => void
  emitMediaUpdate: (item: MediaItem) => void
  log: (level: LogLevel, message: string) => void
  notify: (title: string, body: string) => void
}

function initialState(): JobState {
  return {
    phase: 'idle',
    mode: 'download',
    subreddit: null,
    user: null,
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
  /** Configurable delay between yt-dlp invocations (ms); overridden per job. */
  private ytDlpDelayMs_ = 1500

  /**
   * Media items per post and how many of them finished. A post is only added
   * to history once every item succeeded, otherwise a mixed gallery could be
   * marked done while some slides are still missing.
   */
  private postItemTotals = new Map<string, number>()
  private postItemsDone = new Map<string, number>()

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
      mode: options.mode,
      startedAt: Date.now()
    }
    this.ytDlpDelayMs_ = options.ytDlpDelayMs ?? 1500
    this.setPhase('validating')
    allowMediaRoot(destination)

    try {
      const auth = await this.deps.auth.refresh(false)
      if (!auth.loggedIn) {
        throw new Error(
          auth.message ?? 'Log in on Reddit before starting. Reddit now requires a logged-in session.'
        )
      }

      if (options.mode === 'archive') {
        await this.startArchive(options, destination, controller.signal)
      } else {
        await this.startDownload(options, destination, controller.signal)
      }
    } catch (err) {
      this.state.finishedAt = Date.now()
      if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        this.setPhase('cancelled', 'Cancelled.')
        this.deps.notify('Download cancelled', 'The download was cancelled.')
      } else {
        const message = errorMessage(err)
        this.setPhase('error', message)
        this.deps.log('error', message)
        this.deps.notify('Download failed', message)
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

  /** Start a user archive job (downloads posts from a user's archive). */
  private async startArchive(
    options: JobOptions,
    destination: string,
    signal: AbortSignal
  ): Promise<void> {
    const user = await validateUser(this.deps.auth.client, options.subreddit, signal)
    this.state.user = user
    this.deps.log(
      'info',
      `u/${user.name} — ${user.linkKarma?.toLocaleString() ?? '?'} link karma, ${
        user.commentKarma?.toLocaleString() ?? '?'
      } comment karma`
    )

    await fsp.mkdir(path.join(destination, safeFilename(user.name)), { recursive: true })

    const media = await this.scanUserArchive(user, options, destination, signal)
    const prioritized = this.prioritizeLargeImages(media)

    if (prioritized.length === 0) {
      this.state.finishedAt = Date.now()
      this.setPhase('done', 'No downloadable media found in the scanned posts.')
      this.deps.notify('Download complete', 'No downloadable media found.')
      return
    }

    await this.downloadAll(prioritized, user, options, destination, signal)

    this.state.finishedAt = Date.now()
    const summary = `Downloaded ${this.state.completed} file${
      this.state.completed === 1 ? '' : 's'
    }${this.state.skipped ? `, skipped ${this.state.skipped}` : ''}${
      this.state.failed ? `, ${this.state.failed} failed` : ''
    }.`

    if (signal.aborted) {
      this.setPhase('cancelled', `Cancelled. ${summary}`)
      this.deps.notify('Download cancelled', summary)
    } else {
      this.setPhase('done', summary)
      this.deps.notify('Download complete', summary)
    }
    this.deps.log(signal.aborted ? 'warn' : 'success', summary)
  }

  /** Start a subreddit download job. */
  private async startDownload(
    options: JobOptions,
    destination: string,
    signal: AbortSignal
  ): Promise<void> {
    const subreddit = await validateSubreddit(
      this.deps.auth.client,
      options.subreddit,
      signal
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

    const media = await this.scan(subreddit, options, destination, signal)
    const prioritized = this.prioritizeLargeImages(media)

    if (prioritized.length === 0) {
      this.state.finishedAt = Date.now()
      this.setPhase('done', 'No downloadable media found in the scanned posts.')
      this.deps.notify('Download complete', 'No downloadable media found.')
      return
    }

    await this.downloadAll(prioritized, subreddit, options, destination, signal)

    this.state.finishedAt = Date.now()
    const summary = `Downloaded ${this.state.completed} file${
      this.state.completed === 1 ? '' : 's'
    }${this.state.skipped ? `, skipped ${this.state.skipped}` : ''}${
      this.state.failed ? `, ${this.state.failed} failed` : ''
    }.`

    if (signal.aborted) {
      this.setPhase('cancelled', `Cancelled. ${summary}`)
      this.deps.notify('Download cancelled', summary)
    } else {
      this.setPhase('done', summary)
      this.deps.notify('Download complete', summary)
    }
    this.deps.log(signal.aborted ? 'warn' : 'success', summary)
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

    for await (const page of this.deps.auth.client.pages(subreddit.name, {
      signal,
      sortOrder: options.sortOrder
    })) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const batch: MediaItem[] = []

      for (const post of page.posts) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        if (scanned >= maxPosts) break
        scanned++

        const extracted = extractMedia(post, this.extractOptions(options))
        for (const item of extracted) {
          // Crossposts keep the original post's ID in `item.postId`; check that
          // too so a crosspost is recorded against the ID later sent to history.
          if (this.deps.history.has(subreddit.name, item.postId)) continue
          if (seen.has(item.id)) continue
          seen.add(item.id)

          // Skip posts that have already been downloaded (per history).
          if (this.deps.history.has(subreddit.name, post.id)) {
            continue
          }

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

    this.state.scannedPosts = scanned
    this.state.discovered = media.length
    this.emit()
    return media
  }

  /**
   * Scan a user's archive (submitted posts).
   * Uses `client.userPages()` instead of `client.pages()`.
   */
  private async scanUserArchive(
    user: UserInfo,
    options: JobOptions,
    destination: string,
    signal: AbortSignal
  ): Promise<MediaItem[]> {
    this.setPhase('scanning')
    const media: MediaItem[] = []
    const seen = new Set<string>()
    const seenFiles = new Set<string>()
    const maxPosts = options.maxPosts > 0 ? options.maxPosts : Number.POSITIVE_INFINITY
    const folder = path.join(destination, safeFilename(user.name))
    let scanned = 0

    for await (const page of this.deps.auth.client.userPages(user.name, {
      signal,
      sortOrder: options.sortOrder
    })) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const batch: MediaItem[] = []

      for (const post of page.posts) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        if (scanned >= maxPosts) break
        scanned++

        const extracted = extractMedia(post, this.extractOptions(options))
        for (const item of extracted) {
          // Crossposts keep the original post's ID in `item.postId`; check that
          // too so a crosspost is recorded against the ID later sent to history.
          if (this.deps.history.has(user.name, item.postId)) continue
          if (seen.has(item.id)) continue
          seen.add(item.id)

          // Skip posts that have already been downloaded (per history).
          if (this.deps.history.has(user.name, post.id)) {
            continue
          }

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

    this.state.scannedPosts = scanned
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

  private async downloadAll(
    media: MediaItem[],
    target: SubredditInfo | UserInfo,
    options: JobOptions,
    destination: string,
    signal: AbortSignal
  ): Promise<void> {
    this.setPhase('downloading')
    const folder = path.join(destination, safeFilename(target.name))
    const reserved = new Set<string>()

    this.postItemTotals = new Map<string, number>()
    this.postItemsDone = new Map<string, number>()
    for (const item of media) {
      this.postItemTotals.set(item.postId, (this.postItemTotals.get(item.postId) ?? 0) + 1)
    }

    await runPool(media, options.concurrency, async (item) => {
      if (signal.aborted) return
      await this.downloadItem(item, folder, options.skipExisting, reserved, signal, target.name)
    })
  }

  /** Mark one media item finished; only record the post once all items are done. */
  private markItemDone(subredditName: string, postId: string): void {
    const total = this.postItemTotals.get(postId) ?? 1
    const done = (this.postItemsDone.get(postId) ?? 0) + 1
    this.postItemsDone.set(postId, done)
    if (done >= total) {
      this.deps.history.add(subredditName, postId)
    }
  }

  private activeEntry(item: MediaItem, filename: string): ActiveDownload {
    return {
      id: item.id,
      filename,
      status: 'queued',
      receivedBytes: 0,
      totalBytes: null,
      ratio: null,
      speedBps: null,
      retries: 0
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
    signal: AbortSignal,
    subredditName: string
  ): Promise<void> {
    const initialPath = path.join(folder, item.filename)

    if (skipExisting && fs.existsSync(initialPath)) {
      item.localPath = initialPath
      this.state.skipped++
      this.markItemDone(subredditName, item.postId)
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
        // Throttle yt-dlp calls to avoid 429 rate-limit responses.
        const now = Date.now()
        const elapsed = now - this.lastYtDlpStart_
        if (elapsed < this.ytDlpDelayMs_) {
          await sleep(this.ytDlpDelayMs_ - elapsed, signal)
        }
        const resolved = await this.downloadExternalVideo(item, destination, signal, (received, total) =>
          tick(received, total, total ? received / total : null)
        )
        this.lastYtDlpStart_ = Date.now()
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
          entry.retries = result.retries
          this.emit()
          return
        }

        // Check if the downloaded image is still a thumbnail.
        if (item.kind === 'image' || item.kind === 'gallery' || item.kind === 'external-image') {
          if (isThumbnailFile(destination, item.ext)) {
            this.state.skipped++
            this.deps.log('warn', `Skipped ${item.filename}: still a thumbnail after retries`)
            entry.retries = result.retries
            this.emit()
            return
          }
        }

        item.localPath = destination
        entry.receivedBytes = result.bytes
        entry.retries = result.retries
      }

      if (item.kind !== 'external-video') item.localPath = destination
      entry.status = 'done'
      entry.ratio = 1
      this.state.completed++
      this.markItemDone(subredditName, item.postId)
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

  private async downloadImage(
    item: MediaItem,
    destination: string,
    signal: AbortSignal,
    onProgress: (received: number, total: number | null) => void
  ): Promise<{ bytes: number; retries: number } | { skipped: true; retries: number }> {
    const fetchFn = this.deps.auth.session.fetch.bind(this.deps.auth.session)
    const maxRetries = 3
    let retries = 0
    let lastError: unknown = null

    // Try the primary URL up to maxRetries times.
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return { bytes: (await downloadToFile(fetchFn, item.sourceUrl, destination, { signal, onProgress })).bytes, retries }
      } catch (err) {
        if (signal.aborted) throw err
        lastError = err
        retries++
        if (attempt < maxRetries - 1) {
          this.deps.log(
            'warn',
            `Retrying ${item.filename} (attempt ${attempt + 2}/${maxRetries}): ${errorMessage(err)}`
          )
          await sleep(800 + Math.random() * 400, signal)
        }
      }
    }

    // Fallback to the preview URL, also retrying up to maxRetries times.
    if (item.previewUrl && item.previewUrl !== item.sourceUrl) {
      this.deps.log(
        'warn',
        `Falling back to preview for ${item.filename}: ${
          lastError ? errorMessage(lastError) : 'unknown error'
        }`
      )
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return { bytes: (await downloadToFile(fetchFn, item.previewUrl, destination, { signal, onProgress })).bytes, retries }
        } catch (err) {
          if (signal.aborted) throw err
          lastError = err
          retries++
          if (attempt < maxRetries - 1) {
            this.deps.log(
              'warn',
              `Preview retry ${attempt + 2}/${maxRetries} for ${item.filename}: ${errorMessage(err)}`
            )
            await sleep(800 + Math.random() * 400, signal)
          }
        }
      }
    }

    // All retries exhausted — skip this item instead of failing the whole job.
    this.deps.log(
      'warn',
      `Skipping ${item.filename}: ${lastError ? errorMessage(lastError) : 'unknown error'} (${item.sourceUrl})`
    )
    return { skipped: true, retries }
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

  private lastYtDlpStart_ = 0
}
