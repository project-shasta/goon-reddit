import type { ActiveDownload, JobState, LanguageId } from '@shared/types'
import { useI18n } from '../i18n'
import {
  downloadPercent,
  formatBytes,
  formatCount,
  formatSpeed
} from '../lib/format'
import {
  IconAlert,
  IconCheck,
  IconDownload,
  IconFolder,
  IconInfo,
  IconSpinner,
  IconVideo
} from './icons'

interface JobProgressProps {
  job: JobState
  destination: string
  lang?: LanguageId
}

function statusTone(status: ActiveDownload['status']): string {
  switch (status) {
    case 'done':
      return 'text-emerald-400'
    case 'failed':
      return 'text-red-400'
    case 'cancelled':
      return 'text-zinc-500'
    case 'processing':
      return 'text-amber-300'
    default:
      return 'text-zinc-300'
  }
}

function ActiveRow({
  entry,
  lang = 'en'
}: {
  entry: ActiveDownload
  lang?: LanguageId
}): React.JSX.Element {
  const t = useI18n(lang)
  const percent = downloadPercent(entry)
  const isVideo = String(entry.filename ?? '').toLowerCase().endsWith('.mp4')

  return (
    <li className="space-y-1.5 py-2">
      <div className="flex items-center gap-2 text-xs">
        <span className={`shrink-0 ${statusTone(entry.status)}`}>
          {entry.status === 'done' ? (
            <IconCheck size={13} />
          ) : entry.status === 'failed' ? (
            <span title={entry.error ?? (t.unknownError as string)}>
              <IconAlert size={13} />
            </span>
          ) : entry.status === 'processing' ? (
            <IconVideo size={13} />
          ) : (
            <IconDownload size={13} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-zinc-300" title={entry.filename}>
          {entry.filename}
        </span>
        <span className={`shrink-0 tabular-nums ${statusTone(entry.status)}`}>
          {entry.status === 'done'
            ? (t.done as string)
            : entry.status === 'failed'
              ? (t.failed as string)
              : entry.status === 'cancelled'
                ? (t.cancelled as string)
                : entry.status === 'processing'
                  ? percent !== null
                    ? `${(t.merging as (n: number) => string)(Math.round(percent))}`
                    : '…'
                  : percent !== null
                    ? `${Math.round(percent)}%`
                    : entry.totalBytes
                      ? formatBytes(entry.receivedBytes)
                      : '…'}
        </span>
        {entry.retries > 0 && (
          <span className="shrink-0 text-orange-400" title={`${(t.retriedCount as (n: number) => string)(entry.retries)}`}>
            <IconInfo size={13} />
          </span>
        )}
        {entry.status === 'downloading' && entry.speedBps ? (
          <span className="w-20 shrink-0 text-right tabular-nums text-zinc-500">
            {formatSpeed(entry.speedBps)}
          </span>
        ) : entry.status === 'downloading' && !entry.ratio && entry.totalBytes ? (
          <span className="w-20 shrink-0 text-right tabular-nums text-zinc-500">
            {formatBytes(entry.receivedBytes)} / {formatBytes(entry.totalBytes)}
          </span>
        ) : (
          <span className="w-20 shrink-0" />
        )}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-200 ${
            entry.status === 'failed'
              ? 'bg-red-500'
              : entry.status === 'done'
                ? 'bg-emerald-500'
                : isVideo
                  ? 'bg-amber-400'
                  : 'bg-orange-500'
          }`}
          style={{ width: `${percent ?? (entry.status === 'done' ? 100 : 8)}%` }}
        />
      </div>
      {entry.error && (
        <p className="truncate text-[11px] text-red-400" title={entry.error}>
          {entry.error}
        </p>
      )}
    </li>
  )
}

export function JobProgress({
  job,
  destination,
  lang = 'en'
}: JobProgressProps): React.JSX.Element {
  const t = useI18n(lang)
  const busy = job.phase === 'validating' || job.phase === 'scanning' || job.phase === 'downloading'
  const finished = job.discovered > 0 ? job.completed + job.skipped + job.failed : 0
  const overall =
    job.discovered > 0 ? Math.min(100, (finished / job.discovered) * 100) : null

  const phaseLabel: Record<JobState['phase'], string> = {
    idle: (t.checkingSubreddit as string),
    validating: (t.checkingSubreddit as string),
    scanning: (t.scanningPosts as string),
    downloading: (t.download as string),
    done: (t.finished as string),
    cancelled: (t.cancelled as string),
    error: (t.error as string)
  }

  if (job.phase === 'idle') {
    return (
      <section className="card flex items-center justify-between gap-4 px-4 py-4 text-sm text-zinc-500">
        <span>
          {(t.idleHint as string)}
        </span>
        <button
          className="btn btn-ghost shrink-0 px-2 py-1 text-xs"
          onClick={() => void window.api.openFolder(destination).catch(() => undefined)}
          title={destination}
        >
          <IconFolder size={13} />
          {(t.openFolder as string)}
        </button>
      </section>
    )
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${
            job.phase === 'error'
              ? 'bg-red-500/15 text-red-300'
              : job.phase === 'done'
                ? 'bg-emerald-500/15 text-emerald-300'
                : job.phase === 'cancelled'
                  ? 'bg-white/10 text-zinc-300'
                  : 'bg-orange-500/15 text-orange-300'
          }`}
        >
          {busy && <IconSpinner size={12} />}
          {phaseLabel[job.phase]}
        </span>
        {job.subreddit && (
          <span className="text-sm font-semibold text-zinc-200">r/{job.subreddit.name}</span>
        )}
        <button
          className="btn btn-ghost ml-auto px-2 py-1 text-xs"
          onClick={() => void window.api.openFolder(destination).catch(() => undefined)}
          title={destination}
        >
          <IconFolder size={13} />
          {(t.openFolder as string)}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={(t.postsScanned as string)} value={formatCount(job.scannedPosts)} />
        <Stat label={(t.mediaFound as string)} value={formatCount(job.discovered)} />
        <Stat label={(t.downloaded as string)} value={formatCount(job.completed)} tone="text-emerald-400" />
        <Stat
          label={job.failed > 0 ? (t.skippedFailed as string) : (t.skipped as string)}
          value={formatCount(job.failed > 0 ? job.skipped + job.failed : job.skipped)}
          tone={job.failed > 0 ? 'text-red-400' : 'text-zinc-300'}
        />
      </div>

      {overall !== null && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
              style={{ width: `${overall}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-500">
            <span>
              {(t.finishedOfTotal as (done: number, total: number) => string)(
                finished,
                job.discovered
              )}
            </span>
            <span>{Math.round(overall)}%</span>
          </div>
        </div>
      )}

      {job.message && (
        <p
          className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
            job.phase === 'error'
              ? 'border border-red-500/25 bg-red-500/5 text-red-300'
              : job.phase === 'done'
                ? 'border border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                : 'bg-white/5 text-zinc-300'
          }`}
        >
          {job.phase === 'error' ? (
            <IconAlert size={13} className="mt-0.5 shrink-0" />
          ) : job.phase === 'done' ? (
            <IconCheck size={13} className="mt-0.5 shrink-0" />
          ) : null}
          {job.message}
        </p>
      )}

      {job.active.filter((entry) => entry.status !== 'done').length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
            <span>{t.transfers as string}</span>
            <span>{job.active.filter((entry) => entry.status !== 'done').length} {t.active as string}</span>
          </div>
          <ul className="max-h-64 divide-y divide-white/5 overflow-y-auto pr-1">
            {job.active
              .filter((entry) => entry.status !== 'done')
              .map((entry) => (
                <ActiveRow key={entry.id} entry={entry} lang={lang} />
              ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Stat({
  label,
  value,
  tone = 'text-zinc-100'
}: {
  label: string
  value: string
  tone?: string
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}
