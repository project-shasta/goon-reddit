import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import { IPC } from '@shared/ipc'
import type { AppSettings, DownloadMode, JobOptions, LogEntry } from '@shared/types'
import type { AuthManager } from './auth'
import type { JobRunner } from './job'
import type { SettingsStore } from './settings'
import type { HistoryStore } from './history'
import type { ToolManager } from './tooling'
import { allowMediaRoot } from './mediaProtocol'
import { validateSubreddit, validateUser } from './reddit/validate'
import { errorMessage } from './reddit/errors'

export interface IpcContext {
  auth: AuthManager
  job: JobRunner
  settings: SettingsStore
  history: HistoryStore
  tools: ToolManager
  getMainWindow: () => BrowserWindow | null
  log: (level: LogEntry['level'], message: string) => void
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function buildJobOptions(raw: Partial<JobOptions>, settings: AppSettings): JobOptions {
  const subreddit = String(raw.subreddit ?? '').trim()
  if (!subreddit) throw new Error('Enter a subreddit or username.')

  const destination = path.resolve(
    typeof raw.destination === 'string' && raw.destination.trim()
      ? raw.destination
      : settings.destination
  )

  const mode: DownloadMode =
    (raw.mode === 'archive' ? 'archive' : 'download') as DownloadMode

  const options: JobOptions = {
    subreddit,
    destination,
    mode,
    maxPosts: clampInt(raw.maxPosts, 0, 100000, settings.maxPosts),
    concurrency: clampInt(raw.concurrency, 1, 8, settings.concurrency),
    includeImages: asBool(raw.includeImages, settings.includeImages),
    includeGalleries: asBool(raw.includeGalleries, settings.includeGalleries),
    includeVideos: asBool(raw.includeVideos, settings.includeVideos),
    includeExternalVideos: asBool(raw.includeExternalVideos, settings.includeExternalVideos),
    skipNsfw: asBool(raw.skipNsfw, settings.skipNsfw),
    skipExisting: asBool(raw.skipExisting, settings.skipExisting),
    sortOrder:
      raw.sortOrder && (['new', 'hot', 'top', 'rising'] as const).includes(raw.sortOrder)
        ? raw.sortOrder
        : settings.sortOrder
  }

  if (
    !options.includeImages &&
    !options.includeGalleries &&
    !options.includeVideos &&
    !options.includeExternalVideos
  ) {
    throw new Error('Enable at least one media type.')
  }

  return options
}

export function registerIpcHandlers(ctx: IpcContext): void {
  ipcMain.handle(IPC.authStatus, async () => ctx.auth.refresh(false))
  ipcMain.handle(IPC.authOpenLogin, async () => {
    await ctx.auth.openLogin()
    return true
  })
  ipcMain.handle(IPC.authLogout, async () => {
    await ctx.auth.logout()
    return true
  })

  ipcMain.handle(IPC.subredditValidate, async (_event, name: string) => {
    return validateSubreddit(ctx.auth.client, String(name ?? ''))
  })

  ipcMain.handle(IPC.userValidate, async (_event, name: string) => {
    return validateUser(ctx.auth.client, String(name ?? ''))
  })

  ipcMain.handle(IPC.jobStart, async (_event, raw: Partial<JobOptions>) => {
    if (ctx.job.isRunning()) throw new Error('A job is already running.')
    const options = buildJobOptions(raw ?? {}, ctx.settings.get())
    allowMediaRoot(options.destination)

    ctx.job.start(options).catch((err) => {
      ctx.log('error', errorMessage(err))
    })
    return true
  })

  ipcMain.handle(IPC.jobCancel, async () => {
    ctx.job.cancel()
    return true
  })

  ipcMain.handle(IPC.settingsGet, async () => ctx.settings.get())

  ipcMain.handle(IPC.settingsUpdate, async (_event, patch: Partial<AppSettings>) => {
    const settings = ctx.settings.update(patch ?? {})
    allowMediaRoot(settings.destination)
    return settings
  })

  ipcMain.handle(IPC.settingsChooseDestination, async () => {
    const win = ctx.getMainWindow()
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Choose download destination',
          defaultPath: ctx.settings.get().destination,
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({
          title: 'Choose download destination',
          defaultPath: ctx.settings.get().destination,
          properties: ['openDirectory', 'createDirectory']
        })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.historyTotal, async () => {
    let total = 0
    for (const postIds of ctx.history.getAllPostIds()) {
      total += postIds.size
    }
    return total
  })

  ipcMain.handle(IPC.historyClear, async () => {
    ctx.history.clearAll()
  })

  ipcMain.handle(IPC.toolsStatus, async () => ctx.tools.status())
  ipcMain.handle(IPC.toolsUpdateYtdlp, async () => ctx.tools.updateYtDlp())

  ipcMain.handle(IPC.shellOpenExternal, async (_event, url: string) => {
    const target = String(url ?? '')
    if (!/^https?:\/\//i.test(target)) throw new Error('Refusing to open a non-http URL.')
    await shell.openExternal(target)
    return true
  })

  ipcMain.handle(IPC.shellRevealFile, async (_event, file: string) => {
    const target = path.resolve(String(file ?? ''))
    if (!target) throw new Error('Missing file path.')
    shell.showItemInFolder(target)
    return true
  })

  ipcMain.handle(IPC.shellOpenFolder, async (_event, directory: string) => {
    const target = path.resolve(String(directory ?? ''))
    const error = await shell.openPath(target)
    if (error) throw new Error(error)
    return true
  })

  ipcMain.handle(IPC.shellBeep, async () => {
    shell.beep()
    return true
  })
}
