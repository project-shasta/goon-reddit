import { useState } from 'react'
import type {
  AppSettings,
  AuthStatus,
  DownloadMode,
  JobState,
  LanguageId,
  LogEntry,
  SortOrder,
  SubredditInfo,
  UserInfo
} from '@shared/types'
import { useI18n } from '../i18n'
import { IconSettings } from './icons'
import { SubredditBar } from './SubredditBar'
import { JobProgress } from './JobProgress'
import { AuthPanel } from './AuthPanel'

export interface DownloaderViewProps {
  auth: AuthStatus
  settings: AppSettings
  job: JobState
  logs: LogEntry[]
  subredditInput: string
  validated: SubredditInfo | null
  user: UserInfo | null
  validating: boolean
  validationError: string | null
  mode: DownloadMode
  onModeChange: (mode: DownloadMode) => void
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  onInputChange: (value: string) => void
  onValidate: () => void
  onStart: (mode: DownloadMode) => void
  onCancel: () => void
  onResume: () => void
  onAuthChanged: () => void
  onClearLogs: () => void
  onOpenSettings: () => void
  lang?: LanguageId
}

export function DownloaderView({
  auth,
  settings,
  job,
  logs,
  subredditInput,
  validated,
  user,
  validating,
  validationError,
  mode,
  onModeChange,
  sortOrder,
  onSortOrderChange,
  onInputChange,
  onValidate,
  onStart,
  onCancel,
  onResume,
  onAuthChanged,
  onClearLogs,
  onOpenSettings,
  lang = 'en'
}: DownloaderViewProps): React.JSX.Element {
  const t = useI18n(lang)
  const [logOpen, setLogOpen] = useState(false)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <AuthPanel auth={auth} onChanged={onAuthChanged} lang={lang} />

      <SubredditBar
        value={subredditInput}
        onChange={onInputChange}
        validated={validated}
        user={user}
        validating={validating}
        validationError={validationError}
        mode={mode}
        onModeChange={onModeChange}
        onValidate={onValidate}
        sortOrder={sortOrder}
        onSortOrderChange={onSortOrderChange}
        onStart={onStart}
        onCancel={onCancel}
        onResume={onResume}
        job={job}
        lang={lang}
      />

      {(() => {
        const types = [
          settings.includeImages && (t.images as string),
          settings.includeGalleries && (t.galleries as string),
          settings.includeVideos && (t.redditVideos as string),
          settings.includeExternalVideos && (t.externalVideos as string)
        ].filter(Boolean)

        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/5 bg-white/[0.015] px-3 py-2 text-[11px] text-zinc-500">
            <span className="font-semibold text-zinc-400">{t.fetching as string}</span>
            <span>{types.length ? types.join(' · ') : (t.noMediaTypesEnabled as string)}</span>
            <span className="text-zinc-700">|</span>
            <span>
              newest {settings.maxPosts > 0 ? settings.maxPosts.toLocaleString() : 'all'} posts
            </span>
            <span className="text-zinc-700">|</span>
            <span>{settings.concurrency} {t.parallelDownloads as string}</span>
            <button
              className="btn btn-ghost ml-auto gap-1 px-1.5 py-0.5 text-[11px] text-zinc-400"
              onClick={onOpenSettings}
            >
              <IconSettings size={12} />
              {t.changeSettings as string}
            </button>
          </div>
        )
      })()}

      <JobProgress job={job} destination={settings.destination} lang={lang} />

      {logs.length > 0 && (
        <div>
          <button
            className="btn btn-ghost mb-2 px-2 py-1 text-xs"
            onClick={() => setLogOpen((v) => !v)}
          >
            {logOpen ? (t.hideLog as string) : (t.showLog as string)}
          </button>
          {logOpen && <ActivityLog logs={logs} onClear={onClearLogs} lang={lang} />}
        </div>
      )}
    </div>
  )
}

function ActivityLog({
  logs,
  onClear,
  lang = 'en'
}: {
  logs: LogEntry[]
  onClear: () => void
  lang?: LanguageId
}): React.JSX.Element {
  const t = useI18n(lang)
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/90">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-semibold text-zinc-400">{t.activityLog as string}</span>
        <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onClear}>
          {t.clear as string}
        </button>
      </div>
      <ul className="max-h-48 overflow-y-auto p-2">
        {logs.map((entry, i) => (
          <li
            key={i}
            className={`mb-1 rounded-lg px-2 py-1 text-[11px] font-mono ${
              entry.level === 'error'
                ? 'bg-red-500/10 text-red-300'
                : entry.level === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : entry.level === 'warn'
                    ? 'bg-amber-500/10 text-amber-300'
                    : 'bg-white/5 text-zinc-400'
            }`}
          >
            {new Date(entry.time).toLocaleTimeString()} — {entry.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
