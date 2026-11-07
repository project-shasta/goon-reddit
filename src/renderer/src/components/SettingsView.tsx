import { useEffect, useState } from 'react'
import type { AppSettings, ToolsStatus } from '@shared/types'
import { errorText } from '../lib/format'
import {
  IconAlert,
  IconCheck,
  IconFolder,
  IconRefresh,
  IconSettings,
  IconSpinner
} from './icons'

interface SettingsViewProps {
  settings: AppSettings
  onSave: (patch: Partial<AppSettings>) => Promise<void>
}

type BooleanKey =
  | 'includeImages'
  | 'includeGalleries'
  | 'includeVideos'
  | 'includeExternalVideos'
  | 'skipNsfw'
  | 'skipExisting'
  | 'slideshowAutoPlay'
  | 'blurNsfw'

const MEDIA_TOGGLES: Array<{ key: BooleanKey; label: string; hint: string }> = [
  { key: 'includeImages', label: 'Images', hint: 'Single i.redd.it and direct image posts' },
  { key: 'includeGalleries', label: 'Galleries', hint: 'Multi-image Reddit galleries' },
  { key: 'includeVideos', label: 'Reddit videos', hint: 'DASH/HLS videos with audio via ffmpeg' },
  { key: 'includeExternalVideos', label: 'External videos', hint: 'YouTube, RedGifs, Imgur, etc. via yt-dlp' }
]

const BEHAVIOR_TOGGLES: Array<{ key: BooleanKey; label: string; hint: string }> = [
  { key: 'skipNsfw', label: 'Skip NSFW posts', hint: 'Ignore posts marked over 18' },
  { key: 'skipExisting', label: 'Skip files already downloaded', hint: 'Resume where you left off' },
  { key: 'slideshowAutoPlay', label: 'Auto-play slideshow', hint: 'Start playing when images load' },
  { key: 'blurNsfw', label: 'Blur NSFW in slideshow', hint: 'Click to reveal each image' }
]

export function SettingsView({ settings, onSave }: SettingsViewProps): React.JSX.Element {
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tools, setTools] = useState<ToolsStatus | null>(null)
  const [updatingTools, setUpdatingTools] = useState(false)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const loadTools = async (): Promise<void> => {
    try {
      setTools(await window.api.getToolsStatus())
    } catch (err) {
      setError(errorText(err))
    }
  }

  useEffect(() => {
    void loadTools()
  }, [])

  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const chooseDestination = async (): Promise<void> => {
    try {
      const chosen = await window.api.chooseDestination()
      if (chosen) patch('destination', chosen)
    } catch (err) {
      setError(errorText(err))
    }
  }

  const updateYtDlp = async (): Promise<void> => {
    setUpdatingTools(true)
    setError(null)
    try {
      setTools(await window.api.updateYtDlp())
    } catch (err) {
      setError(errorText(err))
    } finally {
      setUpdatingTools(false)
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      <section className="card space-y-4 p-4">
        <div className="flex items-center gap-2">
          <IconSettings size={16} className="text-orange-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Downloads</h2>
        </div>

        <div>
          <label className="label" htmlFor="destination">
            Destination folder
          </label>
          <div className="flex gap-2">
            <input
              id="destination"
              className="input font-mono text-xs"
              value={draft.destination}
              onChange={(event) => patch('destination', event.target.value)}
            />
            <button className="btn btn-secondary shrink-0" onClick={() => void chooseDestination()}>
              <IconFolder size={14} />
              Browse
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            Files are saved to <span className="font-mono text-zinc-400">destination\subreddit\</span>{' '}
            using the post date, id and title.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="maxPosts">
              Newest posts to scan
            </label>
            <input
              id="maxPosts"
              className="input"
              type="number"
              min={0}
              max={100000}
              value={draft.maxPosts}
              onChange={(event) => patch('maxPosts', Number(event.target.value))}
            />
            <p className="mt-1 text-[11px] text-zinc-500">0 means no limit.</p>
          </div>
          <div>
            <label className="label" htmlFor="concurrency">
              Parallel downloads: {draft.concurrency}
            </label>
            <input
              id="concurrency"
              className="w-full accent-orange-500"
              type="range"
              min={1}
              max={8}
              step={1}
              value={draft.concurrency}
              onChange={(event) => patch('concurrency', Number(event.target.value))}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Higher is faster but more likely to hit Reddit rate limits.
            </p>
          </div>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Media types</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {MEDIA_TOGGLES.map((toggle) => (
            <label key={toggle.key} className="checkbox-row items-start">
              <input
                type="checkbox"
                className="checkbox mt-0.5"
                checked={draft[toggle.key]}
                onChange={(event) => patch(toggle.key, event.target.checked)}
              />
              <span>
                <span className="block font-medium">{toggle.label}</span>
                <span className="block text-[11px] text-zinc-500">{toggle.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Behavior</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {BEHAVIOR_TOGGLES.map((toggle) => (
            <label key={toggle.key} className="checkbox-row items-start">
              <input
                type="checkbox"
                className="checkbox mt-0.5"
                checked={draft[toggle.key]}
                onChange={(event) => patch(toggle.key, event.target.checked)}
              />
              <span>
                <span className="block font-medium">{toggle.label}</span>
                <span className="block text-[11px] text-zinc-500">{toggle.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="interval">
            Slideshow interval: {(draft.slideshowIntervalMs / 1000).toFixed(1)}s
          </label>
          <input
            id="interval"
            className="w-full accent-orange-500"
            type="range"
            min={1000}
            max={15000}
            step={500}
            value={draft.slideshowIntervalMs}
            onChange={(event) => patch('slideshowIntervalMs', Number(event.target.value))}
          />
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-100">Tools</h2>
          <button
            className="btn btn-ghost px-2 py-1 text-xs"
            onClick={() => void loadTools()}
            disabled={updatingTools}
          >
            <IconRefresh size={12} />
            Refresh
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          ffmpeg merges Reddit's separate video and audio streams. yt-dlp handles external video
          hosts. Both live in the app's tools folder so the app stays portable.
        </p>
        <ToolRow
          name="ffmpeg"
          ok={tools?.ffmpeg.ok ?? false}
          version={tools?.ffmpeg.version ?? null}
          path={tools?.ffmpeg.path ?? null}
        />
        <ToolRow
          name="yt-dlp"
          ok={tools?.ytdlp.ok ?? false}
          version={tools?.ytdlp.version ?? null}
          path={tools?.ytdlp.path ?? null}
          action={
            <button
              className="btn btn-secondary px-2 py-1 text-xs"
              onClick={() => void updateYtDlp()}
              disabled={updatingTools}
            >
              {updatingTools ? <IconSpinner size={12} /> : <IconRefresh size={12} />}
              Update
            </button>
          }
        />
        {!tools && <p className="text-[11px] text-zinc-500">Checking tools…</p>}
        {tools && !tools.ffmpeg.ok && (
          <p className="flex items-start gap-2 text-[11px] text-amber-300">
            <IconAlert size={13} className="mt-0.5 shrink-0" />
            ffmpeg was not found. Run <code className="font-mono">npm run tools:setup</code> or place
            ffmpeg in the tools folder. Reddit videos will fall back to video-only downloads.
          </p>
        )}
        {tools && !tools.ytdlp.ok && (
          <p className="flex items-start gap-2 text-[11px] text-amber-300">
            <IconAlert size={13} className="mt-0.5 shrink-0" />
            yt-dlp was not found. External videos will fail until you press Update.
          </p>
        )}
      </section>

      <div className="sticky bottom-0 flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? <IconSpinner size={14} /> : <IconCheck size={14} />}
          Save settings
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
        {dirty && !saved && <span className="text-xs text-zinc-500">Unsaved changes</span>}
        {error && <span className="ml-auto text-xs text-red-400">{error}</span>}
      </div>
    </div>
  )
}

function ToolRow({
  name,
  ok,
  version,
  path,
  action
}: {
  name: string
  ok: boolean
  version: string | null
  path: string | null
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
        }`}
      >
        {ok ? <IconCheck size={13} /> : <IconAlert size={13} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-zinc-200">
          {name}
          {version && <span className="ml-2 font-normal text-zinc-500">{version}</span>}
        </div>
        <div className="truncate font-mono text-[10px] text-zinc-600" title={path ?? ''}>
          {path ?? 'not found'}
        </div>
      </div>
      {action}
    </div>
  )
}
