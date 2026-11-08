import { useEffect, useState } from 'react'
import type { AppSettings, LanguageId, ToolsStatus } from '@shared/types'
import { useI18n } from '../i18n'
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

const MEDIA_TOGGLES: Array<{ key: BooleanKey }> = [
  { key: 'includeImages' },
  { key: 'includeGalleries' },
  { key: 'includeVideos' },
  { key: 'includeExternalVideos' }
]

const BEHAVIOR_TOGGLES: Array<{ key: BooleanKey }> = [
  { key: 'skipNsfw' },
  { key: 'skipExisting' }
]

export function SettingsView({
  settings,
  onSave,
  lang = 'en'
}: SettingsViewProps & { lang?: LanguageId }): React.JSX.Element {
  const t = useI18n(lang)
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tools, setTools] = useState<ToolsStatus | null>(null)
  const [updatingTools, setUpdatingTools] = useState(false)
  const [showNsfwConfirm, setShowNsfwConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

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

  const handleNsfwToggle = (checked: boolean): void => {
    if (checked) {
      setShowNsfwConfirm(true)
    } else {
      patch('skipNsfw', false)
    }
  }

  const confirmNsfwSkip = (): void => {
    patch('skipNsfw', true)
    setShowNsfwConfirm(false)
  }

  const cancelNsfwSkip = (): void => {
    setShowNsfwConfirm(false)
  }

  const resetToDefaults = async (): Promise<void> => {
    setResetting(true)
    setError(null)
    try {
      const next = await window.api.resetToDefaults()
      setDraft(next)
      setShowResetConfirm(false)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      <section className="card space-y-4 p-4">
        <div className="flex items-center gap-2">
          <IconSettings size={16} className="text-orange-400" />
          <h2 className="text-sm font-semibold text-zinc-100">{t.appName as string}</h2>
        </div>

        <div>
          <label className="label" htmlFor="destination">
            {t.destinationFolder as string}
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
              {t.openFolder as string}
            </button>
          </div>
          <p
            className="mt-1.5 text-[11px] text-zinc-500"
            dangerouslySetInnerHTML={{ __html: t.destinationHint as string }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="maxPosts">
              {t.newestPostsToScan as string}
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
            <p className="mt-1 text-[11px] text-zinc-500">{t.zeroMeansNoLimit as string}</p>
          </div>
          <div>
            <label className="label" htmlFor="concurrency">
              {t.parallelDownloads as string}: {draft.concurrency}
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
              {t.higherIsFaster as string}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="ytDlpDelayMs">
              {(t.ytDlpDelayLabel as string)} {draft.ytDlpDelayMs}ms
            </label>
            <input
              id="ytDlpDelayMs"
              className="w-full accent-orange-500"
              type="range"
              min={500}
              max={10000}
              step={100}
              value={draft.ytDlpDelayMs}
              onChange={(event) => patch('ytDlpDelayMs', Number(event.target.value))}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              {t.ytDlpDelayHint as string}
            </p>
          </div>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">{t.mediaTypes as string}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {MEDIA_TOGGLES.map((toggle) => {
            const labels: Record<BooleanKey, { label: string; hint: string }> = {
              includeImages: { label: (t.images as string), hint: (t.imagesHint as string) },
              includeGalleries: { label: (t.galleries as string), hint: (t.galleriesHint as string) },
              includeVideos: { label: (t.redditVideos as string), hint: (t.redditVideosHint as string) },
              includeExternalVideos: { label: (t.externalVideos as string), hint: (t.externalVideosHint as string) },
              skipNsfw: { label: (t.skipNsfw as string), hint: (t.skipNsfwHint as string) },
              skipExisting: { label: (t.skipExisting as string), hint: (t.skipExistingHint as string) }
            }
            const { label, hint } = labels[toggle.key]
            return (
              <label key={toggle.key} className="checkbox-row items-start">
                <input
                  type="checkbox"
                  className="checkbox mt-0.5"
                  checked={draft[toggle.key]}
                  onChange={(event) => patch(toggle.key, event.target.checked)}
                />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-[11px] text-zinc-500">{hint}</span>
                </span>
              </label>
            )
          })}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">{t.behavior as string}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {BEHAVIOR_TOGGLES.map((toggle) => {
            const labels: Record<BooleanKey, { label: string; hint: string }> = {
              includeImages: { label: (t.images as string), hint: (t.imagesHint as string) },
              includeGalleries: { label: (t.galleries as string), hint: (t.galleriesHint as string) },
              includeVideos: { label: (t.redditVideos as string), hint: (t.redditVideosHint as string) },
              includeExternalVideos: { label: (t.externalVideos as string), hint: (t.externalVideosHint as string) },
              skipNsfw: { label: (t.skipNsfw as string), hint: (t.skipNsfwHint as string) },
              skipExisting: { label: (t.skipExisting as string), hint: (t.skipExistingHint as string) }
            }
            const { label, hint } = labels[toggle.key]
            return (
              <label key={toggle.key} className="checkbox-row items-start">
                <input
                  type="checkbox"
                  className="checkbox mt-0.5"
                  checked={draft[toggle.key]}
                  onChange={(event) =>
                    toggle.key === 'skipNsfw'
                      ? handleNsfwToggle(event.target.checked)
                      : patch(toggle.key, event.target.checked)
                  }
                />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-[11px] text-zinc-500">{hint}</span>
                </span>
              </label>
            )
          })}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-100">{t.tools as string}</h2>
          <button
            className="btn btn-ghost px-2 py-1 text-xs"
            onClick={() => void loadTools()}
            disabled={updatingTools}
          >
            <IconRefresh size={12} />
            {t.refresh as string}
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          {t.toolsHint as string}
        </p>
        <ToolRow
          name={(t.ffmpeg as string)}
          ok={tools?.ffmpeg.ok ?? false}
          version={tools?.ffmpeg.version ?? null}
          path={tools?.ffmpeg.path ?? null}
          notFound={t.notFound as string}
        />
        <ToolRow
          name={(t.ytDlp as string)}
          ok={tools?.ytdlp.ok ?? false}
          version={tools?.ytdlp.version ?? null}
          path={tools?.ytdlp.path ?? null}
          notFound={t.notFound as string}
          action={
            <button
              className="btn btn-secondary px-2 py-1 text-xs"
              onClick={() => void updateYtDlp()}
              disabled={updatingTools}
            >
              {updatingTools ? <IconSpinner size={12} /> : <IconRefresh size={12} />}
              {t.update as string}
            </button>
          }
        />
        {!tools && <p className="text-[11px] text-zinc-500">{t.checkingTools as string}</p>}
        {tools && !tools.ffmpeg.ok && (
          <p className="flex items-start gap-2 text-[11px] text-amber-300">
            <IconAlert size={13} className="mt-0.5 shrink-0" />
            {t.noAudioHint as string}
          </p>
        )}
        {tools && !tools.ytdlp.ok && (
          <p className="flex items-start gap-2 text-[11px] text-amber-300">
            <IconAlert size={13} className="mt-0.5 shrink-0" />
            {t.externalVideoFailsHint as string}
          </p>
        )}
      </section>

      {showNsfwConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-5 text-center shadow-2xl">
            <span className="text-2xl">🚧</span>
            <h3 className="mt-3 text-sm font-semibold text-zinc-100">
              {t.nsfwConfirmTitle as string}
            </h3>
            <p
              className="mt-2 text-xs leading-relaxed text-zinc-400"
              dangerouslySetInnerHTML={{ __html: t.nsfwConfirmBody as string }}
            />
            <p className="mt-2 text-xs text-zinc-500">
              {t.nsfwConfirmSubtext as string}
            </p>
            <div className="mt-4 flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={cancelNsfwSkip}>
                {t.nsfwCancel as string}
              </button>
              <button className="btn btn-primary flex-1" onClick={confirmNsfwSkip}>
                {t.nsfwConfirm as string}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-5 text-center shadow-2xl">
            <span className="text-2xl">🔄</span>
            <h3 className="mt-3 text-sm font-semibold text-zinc-100">
              {t.resetConfirmTitle as string}
            </h3>
            <p
              className="mt-2 text-xs leading-relaxed text-zinc-400"
              dangerouslySetInnerHTML={{ __html: t.resetConfirmBody as string }}
            />
            <p className="mt-2 text-xs text-zinc-500">
              {t.resetConfirmSubtext as string}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
              >
                {t.resetCancel as string}
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={() => void resetToDefaults()}
                disabled={resetting}
              >
                {resetting ? <IconSpinner size={12} /> : <IconRefresh size={12} />}
                {t.resetConfirm as string}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <button
          className="btn btn-ghost"
          onClick={() => setShowResetConfirm(true)}
          disabled={saving || resetting}
        >
          <IconRefresh size={14} />
          {t.resetToDefaults as string}
        </button>
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? <IconSpinner size={14} /> : <IconCheck size={14} />}
          {t.saveSettings as string}
        </button>
        {saved && <span className="text-xs text-emerald-400">{t.saved as string}</span>}
        {dirty && !saved && <span className="text-xs text-zinc-500">{t.unsavedChanges as string}</span>}
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
  notFound,
  action
}: {
  name: string
  ok: boolean
  version: string | null
  path: string | null
  notFound: string
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
          {path ?? notFound}
        </div>
      </div>
      {action}
    </div>
  )
}
