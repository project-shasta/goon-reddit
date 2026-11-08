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
  /** URL used for grid thumbnails / fallback. */
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
  /** Number of retry attempts made (sourceUrl + previewUrl). */
  retries: number
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
  mode: 'download'
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

export type SortOrder = 'new' | 'hot' | 'top' | 'rising'
export type Theme = 'dark' | 'midnight' | 'circuit' | 'corporate' | 'vaporwave'
export type LanguageId =
  | 'en'
  | 'de'
  | 'uk'
  | 'zh-TW'
  | 'zh'
  | 'ja'
  | 'fr'
  | 'it'
  | 'es'
  | 'pirate'
  | 'cyberpunk'
  | 'eo'
  | 'enSimple'

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
  sortOrder: SortOrder
  theme: Theme
  language: LanguageId
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
  mode: 'download'
  maxPosts: number
  concurrency: number
  includeImages: boolean
  includeGalleries: boolean
  includeVideos: boolean
  includeExternalVideos: boolean
  skipNsfw: boolean
  skipExisting: boolean
  sortOrder: SortOrder
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
  historyTotal(): Promise<number>
  historyClear(): Promise<void>
  setTheme(theme: string): void
  setLanguage(lang: string): void
  onAuthState(callback: (status: AuthStatus) => void): () => void
  onJobState(callback: (state: JobState) => void): () => void
  onJobMedia(callback: (items: MediaItem[]) => void): () => void
  onJobMediaUpdate(callback: (item: MediaItem) => void): () => void
  onJobLog(callback: (entry: LogEntry) => void): () => void
}
