import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AppSettings,
  AuthStatus,
  JobOptions,
  JobState,
  LogEntry,
  MediaItem,
  SubredditInfo
} from '@shared/types'
import { DownloaderView } from './components/DownloaderView'
import { BrowserView } from './components/BrowserView'
import { SettingsView } from './components/SettingsView'
import { errorText } from './lib/format'
import {
  IconDownload,
  IconImage,
  IconReddit,
  IconSettings,
  IconSpinner
} from './components/icons'

type View = 'download' | 'slideshow' | 'settings'

const INITIAL_AUTH: AuthStatus = {
  loggedIn: false,
  username: null,
  checking: true,
  message: null
}

const INITIAL_JOB: JobState = {
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

const MAX_LOGS = 500
const SUBREDDIT_STORAGE_KEY = 'rdm:last-subreddit'

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>('download')
  const [auth, setAuth] = useState<AuthStatus>(INITIAL_AUTH)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [job, setJob] = useState<JobState>(INITIAL_JOB)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [subredditInput, setSubredditInput] = useState(
    () => localStorage.getItem(SUBREDDIT_STORAGE_KEY) ?? ''
  )
  const [validated, setValidated] = useState<SubredditInfo | null>(null)
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [startupError, setStartupError] = useState<string | null>(null)

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((current) => {
      const next = [...current, entry]
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [settingsResult, authResult] = await Promise.allSettled([
        window.api.getSettings(),
        window.api.getAuthStatus()
      ])
      if (cancelled) return

      if (settingsResult.status === 'fulfilled') {
        setSettings(settingsResult.value)
      } else {
        setStartupError(errorText(settingsResult.reason))
      }

      if (authResult.status === 'fulfilled') {
        setAuth(authResult.value)
      } else {
        setAuth({
          loggedIn: false,
          username: null,
          checking: false,
          message: errorText(authResult.reason)
        })
      }
    })()

    const offAuth = window.api.onAuthState((status) => setAuth(status))
    const offJob = window.api.onJobState((state) => {
      setJob(state)
      if (state.subreddit) {
        setValidated((current) =>
          current && current.name.toLowerCase() === state.subreddit!.name.toLowerCase()
            ? current
            : state.subreddit
        )
        setValidationError(null)
      }
    })
    const offMedia = window.api.onJobMedia((items) =>
      setMedia((current) => {
        const map = new Map(current.map((item) => [item.id, item]))
        for (const item of items) map.set(item.id, item)
        return [...map.values()]
      })
    )
    const offUpdate = window.api.onJobMediaUpdate((item) =>
      setMedia((current) => current.map((existing) => (existing.id === item.id ? item : existing)))
    )
    const offLog = window.api.onJobLog((entry) => addLog(entry))

    return () => {
      cancelled = true
      offAuth()
      offJob()
      offMedia()
      offUpdate()
      offLog()
    }
  }, [addLog])

  useEffect(() => {
    const trimmed = subredditInput.trim()
    if (trimmed) localStorage.setItem(SUBREDDIT_STORAGE_KEY, trimmed)
  }, [subredditInput])

  const busy =
    job.phase === 'validating' || job.phase === 'scanning' || job.phase === 'downloading'

  const handleValidate = useCallback(async () => {
    const name = subredditInput.trim()
    if (!name) return
    setValidating(true)
    setValidationError(null)
    try {
      const info = await window.api.validateSubreddit(name)
      setValidated(info)
      setSubredditInput(info.name)
    } catch (err) {
      setValidated(null)
      setValidationError(errorText(err))
    } finally {
      setValidating(false)
    }
  }, [subredditInput])

  const handleStart = useCallback(
    async (mode: JobOptions['mode']) => {
      if (!settings) return
      const name = subredditInput.trim()
      if (!name) return

      setMedia([])
      setValidationError(null)
      if (validated && validated.name.toLowerCase() !== name.replace(/^r\//i, '').toLowerCase()) {
        setValidated(null)
      }
      setView(mode === 'scan' ? 'slideshow' : 'download')
      setJob({ ...INITIAL_JOB, mode, phase: 'validating', startedAt: Date.now() })

      try {
        await window.api.startJob({
          subreddit: name,
          destination: settings.destination,
          mode,
          maxPosts: settings.maxPosts,
          concurrency: settings.concurrency,
          includeImages: settings.includeImages,
          includeGalleries: settings.includeGalleries,
          includeVideos: settings.includeVideos,
          includeExternalVideos: settings.includeExternalVideos,
          skipNsfw: settings.skipNsfw,
          skipExisting: settings.skipExisting
        })
      } catch (err) {
        setJob(INITIAL_JOB)
        addLog({ level: 'error', message: errorText(err), time: Date.now() })
      }
    },
    [settings, subredditInput, addLog, validated]
  )

  const handleCancel = useCallback(() => {
    void window.api.cancelJob().catch((err) => {
      addLog({ level: 'error', message: errorText(err), time: Date.now() })
    })
  }, [addLog])

  const refreshAuth = useCallback(() => {
    void window.api
      .getAuthStatus()
      .then(setAuth)
      .catch((err) => addLog({ level: 'error', message: errorText(err), time: Date.now() }))
  }, [addLog])

  const handleSaveSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await window.api.updateSettings(patch)
      setSettings(next)
      addLog({ level: 'info', message: 'Settings saved.', time: Date.now() })
    },
    [addLog]
  )

  const handleIntervalChange = useCallback(
    (intervalMs: number) => {
      setSettings((current) => (current ? { ...current, slideshowIntervalMs: intervalMs } : current))
      void window.api.updateSettings({ slideshowIntervalMs: intervalMs }).catch(() => undefined)
    },
    []
  )

  const imageCount = useMemo(
    () =>
      media.filter(
        (item) => item.kind === 'image' || item.kind === 'gallery' || item.kind === 'external-image'
      ).length,
    [media]
  )

  if (!settings) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-400">
        {startupError ? (
          <>
            <span className="text-red-400">Could not start the app</span>
            <p className="max-w-md text-center text-xs text-zinc-500">{startupError}</p>
          </>
        ) : (
          <>
            <IconSpinner size={22} className="text-orange-400" />
            Loading settings…
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-zinc-950">
            <IconReddit size={17} />
          </span>
          <span className="text-sm font-bold tracking-tight text-zinc-100">Reddit Downloader</span>
        </div>

        <nav className="ml-2 flex items-center gap-1 rounded-xl bg-black/30 p-1">
          <button
            className={`tab flex items-center gap-1.5 ${view === 'download' ? 'tab-active' : ''}`}
            onClick={() => setView('download')}
          >
            <IconDownload size={14} />
            Downloader
          </button>
          <button
            className={`tab flex items-center gap-1.5 ${view === 'slideshow' ? 'tab-active' : ''}`}
            onClick={() => setView('slideshow')}
          >
            <IconImage size={14} />
            Slideshow
            {imageCount > 0 && (
              <span className="rounded bg-white/10 px-1 text-[10px] tabular-nums text-zinc-300">
                {imageCount > 999 ? '999+' : imageCount}
              </span>
            )}
          </button>
          <button
            className={`tab flex items-center gap-1.5 ${view === 'settings' ? 'tab-active' : ''}`}
            onClick={() => setView('settings')}
          >
            <IconSettings size={14} />
            Settings
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {busy && (
            <span className="flex items-center gap-1.5 text-xs text-orange-300">
              <IconSpinner size={13} />
              {job.phase === 'downloading' ? 'Downloading' : 'Working'}
            </span>
          )}
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
              auth.loggedIn
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                auth.loggedIn ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            {auth.loggedIn
              ? auth.username
                ? `u/${auth.username}`
                : 'Logged in'
              : auth.checking
                ? 'Checking…'
                : 'Not logged in'}
          </span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {view === 'download' && (
          <DownloaderView
            auth={auth}
            settings={settings}
            job={job}
            logs={logs}
            subredditInput={subredditInput}
            validated={validated}
            validating={validating}
            validationError={validationError}
            onInputChange={setSubredditInput}
            onValidate={() => void handleValidate()}
            onStart={(mode) => void handleStart(mode)}
            onCancel={handleCancel}
            onAuthChanged={refreshAuth}
            onClearLogs={() => setLogs([])}
            onOpenSettings={() => setView('settings')}
          />
        )}

        {view === 'slideshow' && (
          <BrowserView
            media={media}
            job={job}
            settings={settings}
            subreddit={validated ?? job.subreddit}
            onIntervalChange={handleIntervalChange}
            onGoDownload={() => setView('download')}
          />
        )}

        {view === 'settings' && (
          <SettingsView settings={settings} onSave={handleSaveSettings} />
        )}
      </main>
    </div>
  )
}
