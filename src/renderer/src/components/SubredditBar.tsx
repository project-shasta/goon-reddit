import { useCallback, useEffect, useRef, useState } from 'react'
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
  onStart: (mode: 'download' | 'scan') => void
  onCancel: () => void
  job: JobState
  canStart: boolean
}

const SUGGEST_THROTTLE_MS = 600

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

  const [suggestions, setSuggestions] = useState<Array<{ name: string; title?: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Throttled autocomplete request
  const fetchSuggestions = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.trim().length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      try {
        const results = await window.api.suggestSubreddits(query)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
        setSelectedIdx(-1)
      } catch {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, SUGGEST_THROTTLE_MS)
  }, [])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectSuggestion = useCallback((name: string) => {
    onChange(name)
    setShowSuggestions(false)
    setSuggestions([])
    inputRef.current?.focus()
  }, [onChange])

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIdx((prev) => Math.max(prev - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
        selectSuggestion(suggestions[selectedIdx].name)
      } else {
        void onValidate()
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setShowSuggestions(false)
    }
  }, [showSuggestions, suggestions, selectedIdx, selectSuggestion, onValidate])

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value)
    fetchSuggestions(event.target.value)
  }, [onChange, fetchSuggestions])

  return (
    <section className="card space-y-3 p-4" ref={containerRef}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1 relative">
          <label className="label" htmlFor="subreddit">
            Subreddit
          </label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-500">
              r/
            </span>
            <input
              ref={inputRef}
              id="subreddit"
              className="input"
              placeholder="pics"
              value={value}
              spellCheck={false}
              autoComplete="off"
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              disabled={running}
            />
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 shadow-xl">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={suggestion.name}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                    idx === selectedIdx
                      ? 'bg-orange-500/20 text-white'
                      : 'text-zinc-300 hover:bg-white/5'
                  }`}
                  onClick={() => selectSuggestion(suggestion.name)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                >
                  <span className="font-medium">r/{suggestion.name}</span>
                  {suggestion.title && (
                    <span className="truncate text-xs text-zinc-500">{suggestion.title}</span>
                  )}
                </button>
              ))}
            </div>
          )}
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
          <>
            <button
              className="btn btn-secondary"
              onClick={() => onStart('scan')}
              disabled={!canStart}
              title="Scan the subreddit and load the slideshow without downloading"
            >
              <IconGrid size={14} />
              Scan only
            </button>
            <button
              className="btn btn-primary"
              onClick={() => onStart('download')}
              disabled={!canStart}
            >
              <IconDownload size={15} />
              Download new
            </button>
          </>
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
