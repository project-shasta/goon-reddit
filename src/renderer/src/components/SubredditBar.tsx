import type { JobState, SubredditInfo } from '@shared/types'
import { formatCount } from '../lib/format'
import {
  IconAlert,
  IconDownload,
  IconExternal,
  IconGrid,
  IconSpinner,
  IconX
} from './icons'

interface SubredditBarProps {
  value: string
  onChange: (value: string) => void
  validated: SubredditInfo | null
  validating: boolean
  validationError: string | null
  onValidate: () => void
  onStart: (mode: 'download') => void
  onCancel: () => void
  job: JobState
  canStart: boolean
}

export function SubredditBar({
  value,
  onChange,
  validated,
  validating,
  validationError,
  onValidate,
  onStart,
  onCancel,
  job,
  canStart
}: SubredditBarProps): React.JSX.Element {
  const running =
    job.phase === 'validating' || job.phase === 'scanning' || job.phase === 'downloading'

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="subreddit">
            Subreddit
          </label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-500">
              r/
            </span>
            <input
              id="subreddit"
              className="input"
              placeholder="pics"
              value={value}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !running) void onValidate()
              }}
              disabled={running}
            />
          </div>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => void onValidate()}
          disabled={running || validating || !value.trim()}
        >
          {validating ? <IconSpinner size={14} /> : <IconGrid size={14} />}
          Check
        </button>

        {running ? (
          <button className="btn btn-danger" onClick={onCancel}>
            <IconX size={14} />
            Cancel
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => onStart('download')}
            disabled={!canStart}
          >
            <IconDownload size={15} />
            Download new
          </button>
        )}
      </div>

      {validating && !validated && (
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <IconSpinner size={13} className="text-orange-400" />
          Checking r/{value.trim()}…
        </p>
      )}

      {validationError && (
        <p className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-300">
          <IconAlert size={14} className="mt-0.5 shrink-0" />
          {validationError}
        </p>
      )}

      {validated && (
        <div className="fade-in flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          {validated.iconUrl ? (
            <img
              src={validated.iconUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-sm font-bold text-orange-400">
              r/
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-zinc-100">r/{validated.name}</span>
              {validated.over18 && <span className="badge bg-red-500/15 text-red-300">NSFW</span>}
              {validated.quarantined && (
                <span className="badge bg-amber-500/15 text-amber-300">Quarantined</span>
              )}
              <span className="text-xs text-zinc-500">
                {validated.subscribers !== null
                  ? `${formatCount(validated.subscribers)} members`
                  : 'Members hidden'}
              </span>
            </div>
            <p className="truncate text-xs text-zinc-500">{validated.title || 'No title'}</p>
          </div>
          <a
            className="btn btn-ghost shrink-0 px-2 py-1.5"
            href={validated.name ? `https://www.reddit.com/r/${validated.name}/new/` : '#'}
            onClick={(event) => {
              event.preventDefault()
              if (validated.name) {
                void window.api
                  .openExternal(`https://www.reddit.com/r/${validated.name}/new/`)
                  .catch(() => undefined)
              }
            }}
            title="Open on Reddit"
          >
            <IconExternal size={14} />
          </a>
        </div>
      )}
    </section>
  )
}
