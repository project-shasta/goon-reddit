import { useState } from 'react'
import type {
  AppSettings,
  AuthStatus,
  JobState,
  LogEntry,
  SubredditInfo
} from '@shared/types'
import { AuthPanel } from './AuthPanel'
import { SubredditBar } from './SubredditBar'
import { JobProgress } from './JobProgress'
import { LogPanel } from './LogPanel'
import { IconSettings, IconChevronDown, IconChevronUp } from './icons'

interface DownloaderViewProps {
  auth: AuthStatus
  settings: AppSettings
  job: JobState
  logs: LogEntry[]
  subredditInput: string
  validated: SubredditInfo | null
  validating: boolean
  validationError: string | null
  onInputChange: (value: string) => void
  onValidate: () => void
  onStart: (mode: 'download' | 'scan') => void
  onCancel: () => void
  onAuthChanged: () => void
  onClearLogs: () => void
  onOpenSettings: () => void
}

export function DownloaderView({
  auth,
  settings,
  job,
  logs,
  subredditInput,
  validated,
  validating,
  validationError,
  onInputChange,
  onValidate,
  onStart,
  onCancel,
  onAuthChanged,
  onClearLogs,
  onOpenSettings
}: DownloaderViewProps): React.JSX.Element {
  const running =
    job.phase === 'validating' || job.phase === 'scanning' || job.phase === 'downloading'
  const canStart = auth.loggedIn && subredditInput.trim().length > 0 && !running

  const types = [
    settings.includeImages && 'Images',
    settings.includeGalleries && 'Galleries',
    settings.includeVideos && 'Reddit videos',
    settings.includeExternalVideos && 'External videos'
  ].filter(Boolean)

  const [showLogs, setShowLogs] = useState(false)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <AuthPanel auth={auth} onChanged={onAuthChanged} />

      <SubredditBar
        value={subredditInput}
        onChange={onInputChange}
        validated={validated}
        validating={validating}
        validationError={validationError}
        onValidate={onValidate}
        onStart={onStart}
        onCancel={onCancel}
        job={job}
        canStart={canStart}
      />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/5 bg-white/[0.015] px-3 py-2 text-[11px] text-zinc-500">
        <span className="font-semibold text-zinc-400">Fetching:</span>
        <span>{types.length ? types.join(' · ') : 'No media types enabled'}</span>
        <span className="text-zinc-700">|</span>
        <span>
          newest {settings.maxPosts > 0 ? settings.maxPosts.toLocaleString() : 'all'} posts
        </span>
        <span className="text-zinc-700">|</span>
        <span>{settings.concurrency} parallel downloads</span>
        <button
          className="btn btn-ghost ml-auto gap-1 px-1.5 py-0.5 text-[11px] text-zinc-400"
          onClick={onOpenSettings}
        >
          <IconSettings size={12} />
          Change
        </button>
      </div>

      <JobProgress job={job} destination={settings.destination} />

      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Activity</h2>
        <button
          className="btn btn-ghost px-2 py-1 text-xs"
          onClick={onClearLogs}
          disabled={!logs.length}
        >
          Clear
        </button>
      </div>
      {showLogs && <LogPanel logs={logs} onClear={onClearLogs} />}

      <button
        className={`flex w-full items-center gap-1 border-t border-white/5 px-4 py-1.5 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300 ${
          showLogs ? 'rounded-b-xl' : 'rounded-b-xl'
        }`}
        onClick={() => setShowLogs((v) => !v)}
      >
        {showLogs ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
        {showLogs ? 'Hide activity' : 'Show activity'}
      </button>
    </div>
  )
}
