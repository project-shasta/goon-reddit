import { useState } from 'react'
import type { JobState, LanguageId, SortOrder, SubredditInfo } from '@shared/types'
import { useI18n } from '../i18n'
import {
  IconAlert,
  IconCaretDown,
  IconDownload,
  IconExternal,
  IconGrid,
  IconSpinner,
  IconX
} from './icons'

const SORT_ORDER: SortOrder[] = ['new', 'hot', 'top', 'rising']

interface SubredditBarProps {
  value: string
  onChange: (value: string) => void
  validated: SubredditInfo | null
  validating: boolean
  validationError: string | null
  sortOrder: 'new' | 'hot' | 'top' | 'rising'
  onSortOrderChange: (order: 'new' | 'hot' | 'top' | 'rising') => void
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
  sortOrder,
  onSortOrderChange,
  onValidate,
  onStart,
  onCancel,
  job,
  canStart,
  lang = 'en'
}: SubredditBarProps & { lang?: LanguageId }): React.JSX.Element {
  const t = useI18n(lang)
  const running =
    job.phase === 'validating' || job.phase === 'scanning' || job.phase === 'downloading'

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="subreddit">
            {t.subreddit as string}
          </label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-500">
              r/
            </span>
            <input
              id="subreddit"
              className="input"
              placeholder={t.placeholderSubreddit as string | undefined}
              value={value}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !running && !validating) void onValidate()
              }}
              disabled={running}
            />
          </div>
        </div>

        <div className="min-w-[130px]">
          <label className="label" htmlFor="sort-order">
            {t.sortOrder as string}
          </label>
          <SortDropdown
            value={sortOrder}
            onChange={onSortOrderChange}
            disabled={running}
            lang={lang}
          />
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => void onValidate()}
          disabled={running || validating || !value.trim()}
        >
          {validating ? <IconSpinner size={14} /> : <IconGrid size={14} />}
          {t.check as string}
        </button>

        {running ? (
          <button className="btn btn-danger" onClick={onCancel}>
            <IconX size={14} />
            {t.cancel as string}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => onStart('download')}
            disabled={!canStart}
          >
            <IconDownload size={15} />
            {t.downloadNew as string}
          </button>
        )}
      </div>

      {validating && !validated && (
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <IconSpinner size={13} className="text-orange-400" />
          {(t.scanCheckingSubreddit as string)} r/{value.trim()}…
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
              {validated.over18 && <span className="badge bg-red-500/15 text-red-300">{t.nsfw as string}</span>}
              {validated.quarantined && (
                <span className="badge bg-amber-500/15 text-amber-300">{t.quarantined as string}</span>
              )}
              <span className="text-xs text-zinc-500">
                {validated.subscribers !== null
                  ? (t.members as (n: number) => string)(validated.subscribers)
                  : (t.membersHidden as string)}
              </span>
            </div>
            <p className="truncate text-xs text-zinc-500">{validated.title || (t.noTitle as string)}</p>
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
            title={t.openOnReddit as string}
          >
            <IconExternal size={14} />
          </a>
        </div>
      )}
    </section>
  )
}

function SortDropdown({
  value,
  onChange,
  disabled,
  lang = 'en'
}: {
  value: SortOrder
  onChange: (order: SortOrder) => void
  disabled: boolean
  lang?: LanguageId
}): React.JSX.Element {
  const t = useI18n(lang)
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
          disabled
            ? 'border-white/10 bg-black/30 text-zinc-600'
            : 'border-white/10 bg-black/30 text-zinc-200 hover:border-white/20'
        }`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <span>{t[value as keyof typeof t] as string}</span>
        <IconCaretDown size={14} className={`shrink-0 ${disabled ? 'text-zinc-600' : 'text-zinc-500'}`} />
      </button>

      {open && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-lg">
          {SORT_ORDER.map((option) => (
            <button
              key={option}
              className={`flex w-full px-3 py-2 text-sm transition-colors ${
                option === value
                  ? 'bg-orange-500/15 text-orange-300'
                  : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
              }`}
              onClick={() => {
                onChange(option)
                setOpen(false)
              }}
            >
              {t[option as keyof typeof t] as string}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
