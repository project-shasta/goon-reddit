import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppSettings,
  AuthStatus,
  DownloadMode,
  JobState,
  LogEntry,
  LanguageId,
  SortOrder,
  SubredditInfo,
  UserInfo
} from '@shared/types'
import { useI18n, languageIds, languageLabel } from './i18n'
import { DownloaderView } from './components/DownloaderView'
import { SettingsView } from './components/SettingsView'
import { errorText } from './lib/format'
import {
  IconDownload,
  IconSettings,
  IconSpinner
} from './components/icons'

type View = 'download' | 'settings'

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

const MAX_LOGS = 500
const SUBREDDIT_STORAGE_KEY = 'rdm:last-subreddit'

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>('download')
  const [auth, setAuth] = useState<AuthStatus>(INITIAL_AUTH)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [job, setJob] = useState<JobState>(INITIAL_JOB)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [subredditInput, setSubredditInput] = useState(
    () => localStorage.getItem(SUBREDDIT_STORAGE_KEY) ?? ''
  )
  const [validated, setValidated] = useState<SubredditInfo | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [historyCount, setHistoryCount] = useState(0)
  const [showClearKnownConfirm, setShowClearKnownConfirm] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [language, setLanguage] = useState<LanguageId>('en')
  const [sortOrder, setSortOrder] = useState<SortOrder>('new')
  const [mode, setMode] = useState<DownloadMode>('download')
  const t = useI18n(language)

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((current) => {
      const next = [...current, entry]
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next
    })
  }, [])

  const refreshHistoryCount = useCallback(() => {
    void window.api
      .historyTotal()
      .then(setHistoryCount)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [settingsResult, authResult, historyResult] = await Promise.allSettled([
        window.api.getSettings(),
        window.api.getAuthStatus(),
        window.api.historyTotal()
      ])
      if (cancelled) return

      if (settingsResult.status === 'fulfilled') {
        const loadedSettings = settingsResult.value
        setSettings(loadedSettings)
        setSortOrder(loadedSettings.sortOrder)
        window.api.setTheme(loadedSettings.theme)
        setLanguage(loadedSettings.language)
        window.api.setLanguage(loadedSettings.language)
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

      if (historyResult.status === 'fulfilled') {
        setHistoryCount(historyResult.value)
      }
    })()

    const offAuth = window.api.onAuthState((status) => setAuth(status))
    const offJob = window.api.onJobState((state) => {
      setJob(state)
      if (state.phase === 'done') {
        void window.api.shellBeep().catch(() => undefined)
        refreshHistoryCount()
      } else if (state.phase === 'cancelled' || state.phase === 'error') {
        refreshHistoryCount()
      }
      if (state.subreddit?.name) {
        setValidated((current) =>
          current && current.name.toLowerCase() === state.subreddit!.name.toLowerCase()
            ? current
            : state.subreddit
        )
        setValidationError(null)
      }
    })
    const offLog = window.api.onJobLog((entry) => addLog(entry))

    return () => {
      cancelled = true
      offAuth()
      offJob()
      offLog()
    }
  }, [addLog, refreshHistoryCount])

  useEffect(() => {
    const trimmed = subredditInput.trim()
    if (trimmed) localStorage.setItem(SUBREDDIT_STORAGE_KEY, trimmed)
  }, [subredditInput])

  const busy =
    job.phase === 'validating' || job.phase === 'scanning' || job.phase === 'downloading'

  const validatingRef = useRef(false)

  const handleValidate = useCallback(async () => {
    const name = subredditInput.trim()
    if (!name || validatingRef.current) return
    validatingRef.current = true
    setValidating(true)
    setValidationError(null)
    try {
      if (mode === 'archive') {
        const info = await window.api.validateUser(name)
        setUser(info)
        setValidated(null)
        setSubredditInput(info.name)
      } else {
        const info = await window.api.validateSubreddit(name)
        setValidated(info)
        setUser(null)
        setSubredditInput(info.name)
      }
    } catch (err) {
      setValidated(null)
      setUser(null)
      setValidationError(errorText(err))
    } finally {
      setValidating(false)
      validatingRef.current = false
    }
  }, [subredditInput, mode])

  const handleStart = useCallback(
    async (nextMode: DownloadMode) => {
      if (!settings) return
      const name = subredditInput.trim()
      if (!name) return

      setValidationError(null)
      if (mode !== nextMode) {
        setValidated(null)
        setUser(null)
      } else if (mode === 'download' && validated && validated.name.toLowerCase() !== name.replace(/^r\//i, '').toLowerCase()) {
        setValidated(null)
      }
      setJob({ ...INITIAL_JOB, mode: nextMode, phase: 'validating', startedAt: Date.now() })

      try {
        await window.api.startJob({
          subreddit: name,
          destination: settings.destination,
          mode: nextMode,
          maxPosts: settings.maxPosts,
          concurrency: settings.concurrency,
          includeImages: settings.includeImages,
          includeGalleries: settings.includeGalleries,
          includeVideos: settings.includeVideos,
          includeExternalVideos: settings.includeExternalVideos,
          skipNsfw: settings.skipNsfw,
          skipExisting: settings.skipExisting,
          sortOrder
        })
      } catch (err) {
        setJob(INITIAL_JOB)
        addLog({ level: 'error', message: errorText(err), time: Date.now() })
      }
    },
    [settings, subredditInput, addLog, validated, mode, sortOrder]
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
      setSortOrder(next.sortOrder)
      window.api.setTheme(next.theme)
      window.api.setLanguage(next.language)
      setLanguage(next.language)
      addLog({ level: 'info', message: (t.settingsSaved as string), time: Date.now() })
    },
    [addLog, t]
  )

  const handleThemeChange = useCallback(
    (theme: AppSettings['theme']) => {
      setShowThemePicker(false)
      window.api.setTheme(theme)
      void window.api
        .updateSettings({ theme })
        .then((next) => {
          setSettings(next)
          window.api.setTheme(next.theme)
        })
        .catch((err) => {
          addLog({ level: 'error', message: errorText(err), time: Date.now() })
        })
    },
    [addLog]
  )

  const handleLanguageChange = useCallback(
    (nextLanguage: LanguageId) => {
      setShowLangPicker(false)
      setLanguage(nextLanguage)
      window.api.setLanguage(nextLanguage)
      void window.api
        .updateSettings({ language: nextLanguage })
        .then((next) => {
          setSettings(next)
          setLanguage(next.language)
          window.api.setLanguage(next.language)
        })
        .catch((err) => {
          addLog({ level: 'error', message: errorText(err), time: Date.now() })
        })
    },
    [addLog]
  )

  const canStart = useMemo(() => {
    return Boolean(settings && settings.destination && (validated || subredditInput.trim()))
  }, [settings, validated, subredditInput])

  if (!settings) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-400">
        {startupError ? (
          <>
            <span className="text-red-400">{t.startupError as string}</span>
            <p className="max-w-md text-center text-xs text-zinc-500">{startupError}</p>
          </>
        ) : (
          <>
            <IconSpinner size={22} className="text-orange-400" />
            {t.loadingSettings as string}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {showClearKnownConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-5 text-center shadow-2xl">
            <span className="text-2xl">🗑️</span>
            <h3 className="mt-3 text-sm font-semibold text-zinc-100">
              {t.wipeTheSlateClean as string}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              {(t.forgetKnown as (n: number) => string)(historyCount)}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {t.noUndoFilesStillOnDisk as string}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setShowClearKnownConfirm(false)}
              >
                {t.neverMind as string}
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={async () => {
                  await window.api.historyClear()
                  setHistoryCount(0)
                  setShowClearKnownConfirm(false)
                }}
              >
                {t.yeahForgetItAll as string}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-2.5">
        <nav className="flex items-center gap-1 rounded-xl bg-black/30 p-1">
          <button
            className={`tab flex items-center gap-1.5 ${view === 'download' ? 'tab-active' : ''}`}
            onClick={() => setView('download')}
          >
            <IconDownload size={14} />
            {t.downloader as string}
          </button>
          <button
            className={`tab flex items-center gap-1.5 ${view === 'settings' ? 'tab-active' : ''}`}
            onClick={() => setView('settings')}
          >
            <IconSettings size={14} />
            {t.settings as string}
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              className="tab"
              onClick={() => setShowThemePicker((v) => !v)}
              title={t.changeTheme as string}
            >
              🎨 {t.theme as string}
            </button>
            {showThemePicker && (
              <div className="absolute top-full z-50 mt-1 w-48 rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-lg">
                {([
                  { id: 'dark', label: t.darkDefault as string },
                  { id: 'midnight', label: t.midnight as string },
                  { id: 'circuit', label: t.circuitBreaker as string },
                  { id: 'corporate', label: t.corporate as string },
                  { id: 'vaporwave', label: t.vaporwave as string },
                  { id: 'matrix', label: t.matrix as string }
                ] as const).map((th) => (
                  <button
                    key={th.id}
                    className={`flex w-full px-3 py-2 text-sm transition-colors ${
                      settings.theme === th.id
                        ? 'bg-orange-500/15 text-orange-300'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
                    }`}
                    onClick={() => handleThemeChange(th.id)}
                  >
                    {th.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              className="tab"
              onClick={() => setShowLangPicker((v) => !v)}
              title={t.changeLanguage as string}
            >
              🌐 {languageLabel(language)}
            </button>
            {showLangPicker && (
              <div className="absolute top-full z-50 mt-1 max-h-64 w-48 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-lg">
                {languageIds.map((lang) => (
                  <button
                    key={lang}
                    className={`flex w-full px-3 py-2 text-sm transition-colors ${
                      language === lang
                        ? 'bg-orange-500/15 text-orange-300'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
                    }`}
                    onClick={() => handleLanguageChange(lang)}
                  >
                    {languageLabel(lang)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {busy && (
            <span className="flex items-center gap-1.5 text-xs text-orange-300">
              <IconSpinner size={13} />
              {job.phase === 'downloading' ? (t.download as string) : (t.working as string)}
            </span>
          )}
          {historyCount > 0 && (
            <>
              <span className="rounded bg-white/5 px-2 py-1 text-[10px] tabular-nums text-zinc-500" title={t.knownPosts as string}>
                {historyCount.toLocaleString()}
              </span>
              <button
                className="text-[10px] text-zinc-600 underline-offset-4 hover:text-zinc-400 hover:underline"
                onClick={() => setShowClearKnownConfirm(true)}
              >
                {t.clearKnown as string}
              </button>
            </>
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
                : (t.alreadyLoggedIn as string)
              : auth.checking
                ? (t.checkingSession as string)
                : (t.notLoggedIn as string)}
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
            user={user}
            validating={validating}
            validationError={validationError}
            mode={mode}
            onModeChange={setMode}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            onInputChange={setSubredditInput}
            onValidate={() => void handleValidate()}
            onStart={(nextMode) => void handleStart(nextMode)}
            onCancel={handleCancel}
            onAuthChanged={refreshAuth}
            onClearLogs={() => setLogs([])}
            onOpenSettings={() => setView('settings')}
            canStart={canStart}
            lang={language}
          />
        )}

        {view === 'settings' && (
          <SettingsView settings={settings} onSave={handleSaveSettings} lang={language} />
        )}
      </main>
    </div>
  )
}
