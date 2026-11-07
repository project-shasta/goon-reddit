import { app, BrowserWindow, session, shell } from 'electron'
import path from 'node:path'
import { IPC } from '@shared/ipc'
import type { AuthStatus, JobState, LogEntry, MediaItem } from '@shared/types'
import { AuthManager } from './auth'
import { registerIpcHandlers } from './ipc'
import { JobRunner } from './job'
import { allowMediaRoot, installMediaProtocol, registerMediaScheme } from './mediaProtocol'
import { CHROME_UA } from './reddit/client'
import { configureUserData } from './paths'
import { SettingsStore } from './settings'
import { ToolManager } from './tooling'

registerMediaScheme()

app.userAgentFallback = CHROME_UA
app.setName('Reddit Downloader')
// Everything the app writes lives next to the app itself. This must happen
// before whenReady() and before any session is created.
configureUserData()

let mainWindow: BrowserWindow | null = null
let auth: AuthManager | null = null
let job: JobRunner | null = null

function send(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function emitAuth(status: AuthStatus): void {
  send(IPC.authState, status)
}

function emitLog(level: LogEntry['level'], message: string): void {
  send(IPC.jobLog, { level, message, time: Date.now() } satisfies LogEntry)
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0d12',
    title: 'Reddit Downloader',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url).catch(() => undefined)
    return { action: 'deny' }
  })

  const allowedPrefix = process.env.ELECTRON_RENDERER_URL ?? 'file://'
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(allowedPrefix)) event.preventDefault()
  })
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.shasta.redditdownloader')

    const settings = new SettingsStore()
    allowMediaRoot(settings.get().destination)
    installMediaProtocol()
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
      callback(false)
    )

    mainWindow = createMainWindow()
    mainWindow.on('closed', () => {
      mainWindow = null
    })

    auth = new AuthManager(emitAuth)
    job = new JobRunner({
      auth,
      settings,
      tools: new ToolManager(settings),
      emitState: (state: JobState) => send(IPC.jobState, state),
      emitMedia: (items: MediaItem[]) => send(IPC.jobMedia, items),
      emitMediaUpdate: (item: MediaItem) => send(IPC.jobMediaUpdate, item),
      log: emitLog
    })

    registerIpcHandlers({
      auth,
      job,
      settings,
      tools: new ToolManager(settings),
      getMainWindow: () => mainWindow,
      log: emitLog
    })

    void auth.refresh(true)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    job?.cancel()
    auth?.destroy()
  })
}
