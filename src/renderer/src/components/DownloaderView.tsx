import { useState } from 'react'
import type {
  AppSettings,
  AuthStatus,
  JobState,
  LogEntry,
  SortOrder,
  SubredditInfo
} from '@shared/types'
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
  validating: boolean
  validationError: string | null
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  onInputChange: (value: string) => void
  onValidate: () => void
  onStart: (mode: 'download') => void
  onCancel: () => void
  onAuthChanged: () => void
  onClearLogs: () => void
  canStart: boolean
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
  sortOrder,
  onSortOrderChange,
  onInputChange,
  onValidate,
  onStart,
  onCancel,
  onAuthChanged,
  onClearLogs,
  canStart
}: DownloaderViewProps): React.JSX.Element {
  const [logOpen, setLogOpen] = useState(false)

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
        sortOrder={sortOrder}
        onSortOrderChange={onSortOrderChange}
        onStart={onStart}
        onCancel={onCancel}
        job={job}
        canStart={canStart}
      />

      <JobProgress job={job} destination={settings.destination} />

      {logs.length > 0 && (
        <div>
          <button
            className="btn btn-ghost mb-2 px-2 py-1 text-xs"
            onClick={() => setLogOpen((v) => !v)}
          >
            {logOpen ? 'Hide Log' : 'Show Log'}
          </button>
          {logOpen && <ActivityLog logs={logs} onClear={onClearLogs} />}
        </div>
      )}
    </div>
  )
}

function ActivityLog({
  logs,
  onClear
}: {
  logs: LogEntry[]
  onClear: () => void
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/90">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-semibold text-zinc-400">Activity Log</span>
        <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onClear}>
          Clear
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
