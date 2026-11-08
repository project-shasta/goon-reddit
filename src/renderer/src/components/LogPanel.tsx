import { useEffect, useRef } from 'react'
import type { LogEntry, LanguageId } from '@shared/types'
import { useI18n } from '../i18n'

interface LogPanelProps {
  logs: LogEntry[]
  onClear: () => void
  lang?: LanguageId
}

const TONE: Record<LogEntry['level'], string> = {
  info: 'text-zinc-400',
  warn: 'text-amber-300',
  error: 'text-red-400',
  success: 'text-emerald-400'
}

const PREFIX: Record<LogEntry['level'], string> = {
  info: '·',
  warn: '!',
  error: '×',
  success: '✓'
}

function formatTime(time: number): string {
  return new Date(time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function LogPanel({
  logs,
  onClear,
  lang = 'en'
}: LogPanelProps): React.JSX.Element {
  const t = useI18n(lang)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [logs.length])

  return (
    <section className="card flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
          {t.activityLog as string}
        </h2>
        <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onClear} disabled={!logs.length}>
          {t.clear as string}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 font-mono text-[11.5px] leading-relaxed">
        {logs.length === 0 ? (
          <p className="py-6 text-center font-sans text-xs text-zinc-600">
            {t.downloadNewHint as string}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {logs.map((entry, index) => (
              <li key={`${entry.time}-${index}`} className="flex gap-2">
                <span className="shrink-0 tabular-nums text-zinc-600">{formatTime(entry.time)}</span>
                <span className={`w-3 shrink-0 ${TONE[entry.level]}`}>{PREFIX[entry.level]}</span>
                <span className={`min-w-0 flex-1 break-words ${TONE[entry.level]}`}>
                  {entry.message}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>
    </section>
  )
}
