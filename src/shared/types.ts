export interface SubredditInfo {
  name: string
  title: string
  description: string
  subscribers: number | null
  over18: boolean
  quarantined: boolean
  subredditType: string
  iconUrl: string | null
  bannerUrl: string | null
  validatedAt: number
}

export type MediaKind = 'image' | 'gallery' | 'video' | 'external-video' | 'external-image'

export type VideoStrategy = 'dash' | 'hls' | 'fallback' | 'ytdlp'

export interface MediaItem {
  /** Unique per post + media index, e.g. "1abc23:0". */
  id: string
  postId: string
  mediaId: string | null
  kind: MediaKind
  sourceUrl: string
  /** URL used for grid thumbnails / slideshow fallback. */
  previewUrl: string | null
  ext: string
  /** Sanitized filename without directory. */
  filename: string
  postTitle: string
  author: string
  permalink: string
  score: number
  over18: boolean
  createdUtc: number
  width: number | null
  height: number | null
  duration: number | null
  videoStrategy?: VideoStrategy
  /** Reddit-hosted video fallbacks, tried in order when the primary fails. */
  videoAlternates?: {
    dash?: string
    hls?: string
    fallback?: string
  }
  /** Set once the file exists on disk. */
  localPath: string | null
}

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'processing'
  | 'done'
  | 'skipped'
  | 'failed'
  | 'cancelled'

export interface ActiveDownload {
  id: string
  filename: string
  status: DownloadStatus
  receivedBytes: number
  totalBytes: number | null
  /** Explicit progress for ffmpeg jobs where byte counts are unknown. 0..1 */
  ratio: number | null
  speedBps: number | null
  error?: string
}

export type JobPhase =
  | 'idle'
  | 'validating'
  | 'scanning'
  | 'downloading'
  | 'done'
  | 'cancelled'
  | 'error'

export interface JobState {
  phase: JobPhase
  mode: 'download' | 'scan'
  subreddit: SubredditInfo | null
  scannedPosts: number
  discovered: number
  completed: number
  skipped: number
  failed: number
  active: ActiveDownload[]
  message: string | null
  startedAt: number | null
  finishedAt: number | null
}

export interface AuthStatus {
  loggedIn: boolean
  username: string | null
  checking: boolean
  message: string | null
}

export interface AppSettings {
  destination: string
  maxPosts: number
  concurrency: number
  includeImages: boolean
  includeGalleries: boolean
  includeVideos: boolean
  includeExternalVideos: boolean
  skipNsfw: boolean
  skipExisting: boolean
  slideshowIntervalMs: number
  blurNsfw: boolean
  toolsDir: string | null
}

export interface ToolInfo {
  name: 'ffmpeg' | 'yt-dlp'
  path: string | null
  version: string | null
  ok: boolean
}

export interface ToolsStatus {
  toolsDir: string
  ffmpeg: ToolInfo
  ytdlp: ToolInfo
}

export interface JobOptions {
  subreddit: string
  destination: string
  mode: 'download' | 'scan'
  maxPosts: number
  concurrency: number
  includeImages: boolean
  includeGalleries: boolean
  includeVideos: boolean
  includeExternalVideos: boolean
  skipNsfw: boolean
  skipExisting: boolean
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  time: number
}

export interface ToolsSetupResult {
  tools: ToolsStatus
  log: string[]
}

export interface RendererApi {
  getAuthStatus(): Promise<AuthStatus>
  openLogin(): Promise<boolean>
  logout(): Promise<boolean>
  validateSubreddit(name: string): Promise<SubredditInfo>
  suggestSubreddits(query: string): Promise<Array<{ name: string; title?: string }>>
  startJob(options: Partial<JobOptions>): Promise<boolean>
  cancelJob(): Promise<boolean>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  chooseDestination(): Promise<string | null>
  getToolsStatus(): Promise<ToolsStatus>
  updateYtDlp(): Promise<ToolsStatus>
  openExternal(url: string): Promise<boolean>
  revealFile(path: string): Promise<boolean>
  openFolder(path: string): Promise<boolean>
  onAuthState(callback: (status: AuthStatus) => void): () => void
  onJobState(callback: (state: JobState) => void): () => void
  onJobMedia(callback: (items: MediaItem[]) => void): () => void
  onJobMediaUpdate(callback: (item: MediaItem) => void): () => void
  onJobLog(callback: (entry: LogEntry) => void): () => void
}
