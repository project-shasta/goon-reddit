import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { AppSettings, LanguageId, Theme } from '@shared/types'
import { clampInt, asBool } from '@shared/util'
import { getDataDir } from './paths'

const SETTINGS_FILE = () => path.join(getDataDir(), 'settings.json')

export function defaults(): AppSettings {
  return {
    destination: path.join(app.getPath('downloads'), 'Reddit Downloads'),
    maxPosts: 100,
    concurrency: 4,
    ytDlpDelayMs: 1500,
    includeImages: true,
    includeGalleries: true,
    includeVideos: true,
    includeExternalVideos: true,
    skipNsfw: false,
    skipExisting: true,
    sortOrder: 'new' as const,
    theme: 'dark' as const,
    language: 'en' as const,
    toolsDir: null
  }
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
      maxPosts: clampInt(next.maxPosts, 0, 100000, base.maxPosts),
      concurrency: clampInt(next.concurrency, 1, 8, base.concurrency),
      ytDlpDelayMs: clampInt(next.ytDlpDelayMs, 500, 10000, base.ytDlpDelayMs),
      includeImages: asBool(next.includeImages, base.includeImages),
      includeGalleries: asBool(next.includeGalleries, base.includeGalleries),
      includeVideos: asBool(next.includeVideos, base.includeVideos),
      includeExternalVideos: asBool(next.includeExternalVideos, base.includeExternalVideos),
      skipNsfw: asBool(next.skipNsfw, base.skipNsfw),
      skipExisting: asBool(next.skipExisting, base.skipExisting),
      sortOrder: (['new', 'hot', 'top', 'rising'] as const).includes(next.sortOrder)
        ? next.sortOrder
        : base.sortOrder,
      theme: (['dark', 'midnight', 'circuit', 'corporate', 'vaporwave', 'matrix'] as const).includes(
        next.theme
      )
        ? (next.theme as Theme)
        : base.theme,
      language: (
        ['en', 'de', 'uk', 'zh-TW', 'zh', 'ja', 'fr', 'it', 'es', 'pirate', 'cyberpunk', 'eo', 'enSimple', 'matrix'] as const
      ).includes(next.language)
        ? (next.language as LanguageId)
        : base.language,
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

  resetToDefaults(): AppSettings {
    this.settings = defaults()
    this.save()
    return this.get()
  }
}
