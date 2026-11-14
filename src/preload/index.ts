import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

declare const document: { documentElement: { removeAttribute(k: string): void; setAttribute(k: string, v: string): void } }

import { IPC } from '../shared/ipc'
import type {
  AppSettings,
  AuthStatus,
  JobOptions,
  JobState,
  LogEntry,
  MediaItem,
  RendererApi
} from '../shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: RendererApi = {
  getAuthStatus: () => ipcRenderer.invoke(IPC.authStatus),
  openLogin: () => ipcRenderer.invoke(IPC.authOpenLogin),
  logout: () => ipcRenderer.invoke(IPC.authLogout),
  validateSubreddit: (name: string) => ipcRenderer.invoke(IPC.subredditValidate, name),
  validateUser: (name: string) => ipcRenderer.invoke(IPC.userValidate, name),
  startJob: (options: Partial<JobOptions>) => ipcRenderer.invoke(IPC.jobStart, options),
  cancelJob: () => ipcRenderer.invoke(IPC.jobCancel),
  resumeJob: () => ipcRenderer.invoke(IPC.jobResume),
  getJobState: () => ipcRenderer.invoke(IPC.jobGetState),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  updateSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke(IPC.settingsUpdate, patch),
  chooseDestination: () => ipcRenderer.invoke(IPC.settingsChooseDestination),
  resetToDefaults: () => ipcRenderer.invoke(IPC.settingsResetToDefaults),
  getToolsStatus: () => ipcRenderer.invoke(IPC.toolsStatus),
  updateYtDlp: () => ipcRenderer.invoke(IPC.toolsUpdateYtdlp),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.shellOpenExternal, url),
  revealFile: (file: string) => ipcRenderer.invoke(IPC.shellRevealFile, file),
  openFolder: (directory: string) => ipcRenderer.invoke(IPC.shellOpenFolder, directory),
  historyTotal: () => ipcRenderer.invoke(IPC.historyTotal),
  historyClear: () => ipcRenderer.invoke(IPC.historyClear),
  clearCache: () => ipcRenderer.invoke(IPC.cacheClear),
  shellBeep: () => ipcRenderer.invoke(IPC.shellBeep),
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke(IPC.notificationShow, { title, body }),
  onAuthState: (callback: (status: AuthStatus) => void) =>
    subscribe<AuthStatus>(IPC.authState, callback),
  onJobState: (callback: (state: JobState) => void) =>
    subscribe<JobState>(IPC.jobState, callback),
  onJobMedia: (callback: (items: MediaItem[]) => void) =>
    subscribe<MediaItem[]>(IPC.jobMedia, callback),
  onJobMediaUpdate: (callback: (item: MediaItem) => void) =>
    subscribe<MediaItem>(IPC.jobMediaUpdate, callback),
  onJobLog: (callback: (entry: LogEntry) => void) =>
    subscribe<LogEntry>(IPC.jobLog, callback),
  setTheme: (theme: string) => {
    document.documentElement.removeAttribute('data-theme')
    if (theme !== 'dark') document.documentElement.setAttribute('data-theme', theme)
  },
  setLanguage: (lang: string) => {
    document.documentElement.setAttribute('data-lang', lang)
  }
}

contextBridge.exposeInMainWorld('api', api)
