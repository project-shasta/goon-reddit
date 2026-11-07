import { useMemo } from 'react'
import type { AppSettings, JobState, MediaItem, SubredditInfo } from '@shared/types'
import { isViewableImage } from '../lib/media'
import { Slideshow } from './Slideshow'
import { IconGrid, IconImage } from './icons'

interface BrowserViewProps {
  media: MediaItem[]
  job: JobState
  settings: AppSettings
  subreddit: SubredditInfo | null
  onIntervalChange: (intervalMs: number) => void
  onGoDownload: () => void
}

export function BrowserView({
  media,
  job,
  settings,
  subreddit,
  onIntervalChange,
  onGoDownload
}: BrowserViewProps): React.JSX.Element {
  const images = useMemo(() => media.filter(isViewableImage), [media])
  const busy = job.phase === 'scanning' || job.phase === 'validating'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-white/[0.015] px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          <IconImage size={14} className="text-orange-400" />
          Slideshow
        </span>
        {subreddit && (
          <span className="text-xs text-zinc-500">
            r/{subreddit.name} · {images.length.toLocaleString()} image
            {images.length === 1 ? '' : 's'} loaded
          </span>
        )}
        {settings.blurNsfw && <span className="badge bg-red-500/15 text-red-300">NSFW blurred</span>}
        <button className="btn btn-ghost ml-auto px-2 py-1 text-xs" onClick={onGoDownload}>
          <IconGrid size={13} />
          {images.length === 0 ? 'Scan a subreddit' : 'Downloader'}
        </button>
      </div>

      <Slideshow
        images={images}
        intervalMs={settings.slideshowIntervalMs}
        blurNsfw={settings.blurNsfw}
        busy={busy}
        emptyHint={
          subreddit
            ? `No images were found in r/${subreddit.name}. Head back to the Downloader and start a scan, or pick another subreddit.`
            : 'Use Scan only on the Downloader tab to load a subreddit’s images here without downloading them. Downloaded files play from disk; everything else streams from Reddit.'
        }
        onIntervalChange={onIntervalChange}
      />
    </div>
  )
}
