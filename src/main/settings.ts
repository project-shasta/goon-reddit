import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { AppSettings, Theme } from '@shared/types'
import { getDataDir } from './paths'

const SETTINGS_FILE = () => path.join(getDataDir(), 'settings.json')

function defaults(): AppSettings {
  return {
    destination: path.join(app.getPath('downloads'), 'Reddit Downloads'),
    maxPosts: 100,
    concurrency: 4,
    includeImages: true,
    includeGalleries: true,
    includeVideos: true,
    includeExternalVideos: true,
    skipNsfw: false,
    skipExisting: true,
    sortOrder: 'new' as const,
    theme: 'dark' as const,
    toolsDir: null
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export class SettingsStore {
  private settings: AppSettings

  constructor() {
    this.settings = this.load()
  }

  private load(): AppSettings {
    const base = defaults()
    try {
      const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')) as Partial<AppSettings>
      return this.sanitize({ ...base, ...raw }, base)
    } catch {
      return base
    }
  }

  private sanitize(next: AppSettings, base: AppSettings): AppSettings {
    return {
      destination:
        typeof next.destination === 'string' && next.destination.trim()
          ? path.resolve(next.destination)
          : base.destination,
      maxPosts: clampInt(next.maxPosts, 0, 10000, base.maxPosts),
      concurrency: clampInt(next.concurrency, 1, 8, base.concurrency),
      includeImages: asBool(next.includeImages, base.includeImages),
      includeGalleries: asBool(next.includeGalleries, base.includeGalleries),
      includeVideos: asBool(next.includeVideos, base.includeVideos),
      includeExternalVideos: asBool(next.includeExternalVideos, base.includeExternalVideos),
      skipNsfw: asBool(next.skipNsfw, base.skipNsfw),
      skipExisting: asBool(next.skipExisting, base.skipExisting),
      sortOrder: (['new', 'hot', 'top', 'rising'] as const).includes(next.sortOrder)
        ? next.sortOrder
        : base.sortOrder,
      theme: (['dark', 'midnight', 'circuit', 'corporate', 'vaporwave'] as const).includes(
        next.theme
      )
        ? (next.theme as Theme)
        : base.theme,
      toolsDir:
        typeof next.toolsDir === 'string' && next.toolsDir.trim()
          ? path.resolve(next.toolsDir)
          : null
    }
  }

  private save(): void {
    const file = SETTINGS_FILE()
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.settings, null, 2), 'utf8')
    fs.renameSync(tmp, file)
  }

  get(): AppSettings {
    return { ...this.settings }
  }

  update(patch: Partial<AppSettings>): AppSettings {
    this.settings = this.sanitize({ ...this.settings, ...patch }, defaults())
    this.save()
    return this.get()
  }
}
