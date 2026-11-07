import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MediaItem } from '@shared/types'
import { isRedditPreviewHost, mediaFallbackSrc, mediaSrc } from '../lib/media'
import { timeAgo } from '../lib/format'
import {
  IconChevronLeft,
  IconChevronRight,
  IconExternal,
  IconImage,
  IconPause,
  IconPlay,
  IconSpinner
} from './icons'

interface SlideshowProps {
  images: MediaItem[]
  intervalMs: number
  autoPlay: boolean
  blurNsfw: boolean
  busy: boolean
  emptyHint: string
  onIntervalChange: (intervalMs: number) => void
}

const INTERVALS = [1500, 2500, 4000, 6000, 10000]

export function Slideshow({
  images,
  intervalMs,
  autoPlay,
  blurNsfw,
  busy,
  emptyHint,
  onIntervalChange
}: SlideshowProps): React.JSX.Element {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const [revealed, setRevealed] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())

  const count = images.length
  const current = count > 0 ? images[Math.min(index, count - 1)] : null

  useEffect(() => {
    if (index >= count) setIndex(Math.max(0, count - 1))
  }, [count, index])

  useEffect(() => {
    setRevealed(false)
    setUseFallback(false)
  }, [current?.id])

  // Reset skipped set when the images list changes (new scan).
  useEffect(() => {
    setSkipped(new Set())
  }, [images.length])

  const go = useCallback(
    (delta: number) => {
      if (count === 0) return
      setIndex((value) => (value + delta + count) % count)
    },
    [count]
  )

  const goTo = useCallback(
    (value: number) => {
      if (count === 0) return
      setIndex(((value % count) + count) % count)
    },
    [count]
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        go(1)
      } else if (event.key === ' ') {
        event.preventDefault()
        setPlaying((value) => !value)
      } else if (event.key === 'f' || event.key === 'F') {
        const el = document.getElementById('slideshow-stage')
        if (document.fullscreenElement) void document.exitFullscreen()
        else void el?.requestFullscreen().catch(() => undefined)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  useEffect(() => {
    if (!playing || count <= 1) return
    const timer = setTimeout(() => go(1), intervalMs)
    return () => clearTimeout(timer)
  }, [playing, count, intervalMs, go, index])

  const PRELOAD_AHEAD = 3

  const urlsToPreload = useMemo(() => {
    if (count <= 1) return []
    const urls: string[] = []
    for (let i = 1; i <= PRELOAD_AHEAD; i++) {
      const candidate = (index + i) % count
      if (!skipped.has(images[candidate].id)) {
        const url = mediaSrc(images[candidate])
        if (url && urls.indexOf(url) === -1) urls.push(url)
      }
    }
    return urls
  }, [count, images, index, skipped])

  useEffect(() => {
    for (const url of urlsToPreload) {
      const preload = new Image()
      preload.src = url
    }
  }, [urlsToPreload])

  const fullSrc = current ? (useFallback ? mediaFallbackSrc(current) : mediaSrc(current)) : null
  const blurred = Boolean(current?.over18 && blurNsfw && !revealed)
  const thumbStart = count <= 121 ? 0 : Math.max(0, Math.min(index - 60, count - 121))
  const thumbs = images
    .slice(thumbStart, thumbStart + 121)
    .map((item, offset) => ({ item, itemIndex: thumbStart + offset }))

  if (count === 0) {
    return (
      <div className="card flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        {busy ? (
          <>
            <IconSpinner size={28} className="text-orange-400" />
            <p className="text-sm font-medium text-zinc-300">Scanning the subreddit…</p>
            <p className="max-w-sm text-xs text-zinc-500">
              Images will stream into the slideshow as posts are found.
            </p>
          </>
        ) : (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
              <IconImage size={26} />
            </span>
            <p className="text-sm font-medium text-zinc-300">No images to show yet</p>
            <p className="max-w-sm text-xs leading-relaxed text-zinc-500">{emptyHint}</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div
      id="slideshow-stage"
      className="card relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black"
    >
      <div className="relative min-h-0 flex-1 bg-black">
        {current && fullSrc ? (
          <img
            key={`${current.id}:${useFallback ? 'fallback' : 'primary'}`}
            src={fullSrc}
            alt={current.postTitle || current.filename}
            className={`h-full w-full object-contain transition-[filter] duration-300 ${
              blurred ? 'scale-105 blur-2xl' : ''
            }`}
            onError={() => {
              const fb = mediaFallbackSrc(current)
              if (useFallback) {
                // Both primary and fallback failed — skip this broken image.
                setSkipped((prev) => new Set(prev).add(current!.id))
                go(1)
              } else if (!useFallback && fb) {
                // If the fallback is a Reddit preview-host URL, it's almost
                // certainly the "image deleted" placeholder — skip instead.
                if (isRedditPreviewHost(fb)) {
                  setSkipped((prev) => new Set(prev).add(current!.id))
                  go(1)
                } else {
                  setUseFallback(true)
                }
              }
            }}
          />
        ) : null}

        {blurred && (
          <button
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 text-zinc-200"
            onClick={() => setRevealed(true)}
          >
            <span className="badge bg-red-500/80 px-2 py-1 text-white">NSFW</span>
            <span className="text-xs font-medium">Click to reveal</span>
          </button>
        )}

        {count > 1 && (
          <>
            <button
              className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/80 opacity-0 backdrop-blur transition hover:bg-black/70 hover:text-white focus:opacity-100 group-hover:opacity-100 sm:opacity-100"
              onClick={() => go(-1)}
              title="Previous (←)"
            >
              <IconChevronLeft size={20} />
            </button>
            <button
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/80 opacity-0 backdrop-blur transition hover:bg-black/70 hover:text-white focus:opacity-100 group-hover:opacity-100 sm:opacity-100"
              onClick={() => go(1)}
              title="Next (→)"
            >
              <IconChevronRight size={20} />
            </button>
          </>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 via-black/30 to-transparent px-4 pt-3 pb-8">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold text-white drop-shadow">
                {current?.postTitle || current?.filename}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                <span>u/{current?.author}</span>
                <span>·</span>
                <span>↑ {current?.score.toLocaleString()}</span>
                {current?.createdUtc ? (
                  <>
                    <span>·</span>
                    <span>{timeAgo(current.createdUtc)}</span>
                  </>
                ) : null}
                {current?.kind === 'gallery' && (
                  <span className="badge bg-orange-500/20 text-orange-200">gallery</span>
                )}
                {current?.localPath && (
                  <span className="badge bg-emerald-500/20 text-emerald-200">downloaded</span>
                )}
              </p>
            </div>
            {current?.permalink && (
              <button
                className="pointer-events-auto rounded-lg bg-black/40 p-1.5 text-white/70 transition hover:bg-black/60 hover:text-white"
                onClick={() => void window.api.openExternal(current.permalink).catch(() => undefined)}
                title="Open post on Reddit"
              >
                <IconExternal size={14} />
              </button>
            )}
          </div>
        </div>

        {playing && count > 1 && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
            <div
              key={`${index}:${playing}`}
              className="slide-progress h-full bg-orange-500"
              style={{ animationDuration: `${intervalMs}ms` }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-zinc-950/90 px-3 py-2">
        <button
          className="btn btn-secondary px-2.5 py-1.5"
          onClick={() => setPlaying((value) => !value)}
          title={playing ? 'Pause (space)' : 'Play (space)'}
        >
          {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
          {playing ? 'Pause' : 'Play'}
        </button>

        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost px-1.5 py-1"
            onClick={() => go(-1)}
            title="Previous (←)"
          >
            <IconChevronLeft size={15} />
          </button>
          <span className="min-w-[5.5rem] text-center text-xs tabular-nums text-zinc-400">
            {index + 1} / {count}
          </span>
          <button className="btn btn-ghost px-1.5 py-1" onClick={() => go(1)} title="Next (→)">
            <IconChevronRight size={15} />
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          Speed
          <select
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-300 outline-none"
            value={intervalMs}
            onChange={(event) => onIntervalChange(Number(event.target.value))}
          >
            {INTERVALS.map((value) => (
              <option key={value} value={value}>
                {(value / 1000).toFixed(1)}s
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] text-zinc-600">← → · space · F</span>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-t border-white/10 bg-zinc-950/90 px-3 py-2">
        {thumbs
          .filter(({ item }) => !skipped.has(item.id))
          .map(({ item, itemIndex }) => (
            <button
              key={item.id}
              className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border transition ${
                itemIndex === index
                  ? 'border-orange-400 opacity-100'
                  : 'border-white/10 opacity-50 hover:opacity-90'
              }`}
              onClick={() => goTo(itemIndex)}
              title={item.postTitle || item.filename}
            >
              <img
                src={item.previewUrl ?? mediaSrc(item)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(event) => {
                  const fallback = mediaFallbackSrc(item)
                  if (fallback && event.currentTarget.src !== fallback) {
                    event.currentTarget.src = fallback
                  }
                }}
              />
              {item.over18 && (
                <span className="absolute right-0.5 bottom-0.5 rounded bg-red-500 px-1 text-[8px] font-bold text-white">
                  18+
                </span>
              )}
            </button>
          ))}
      </div>
    </div>
  )
}
