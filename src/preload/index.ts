import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
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
  startJob: (options: Partial<JobOptions>) => ipcRenderer.invoke(IPC.jobStart, options),
  cancelJob: () => ipcRenderer.invoke(IPC.jobCancel),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  updateSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke(IPC.settingsUpdate, patch),
  chooseDestination: () => ipcRenderer.invoke(IPC.settingsChooseDestination),
  getToolsStatus: () => ipcRenderer.invoke(IPC.toolsStatus),
  updateYtDlp: () => ipcRenderer.invoke(IPC.toolsUpdateYtdlp),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.shellOpenExternal, url),
  revealFile: (file: string) => ipcRenderer.invoke(IPC.shellRevealFile, file),
  openFolder: (directory: string) => ipcRenderer.invoke(IPC.shellOpenFolder, directory),
  onAuthState: (callback: (status: AuthStatus) => void) =>
    subscribe<AuthStatus>(IPC.authState, callback),
  onJobState: (callback: (state: JobState) => void) =>
    subscribe<JobState>(IPC.jobState, callback),
  onJobMedia: (callback: (items: MediaItem[]) => void) =>
    subscribe<MediaItem[]>(IPC.jobMedia, callback),
  onJobMediaUpdate: (callback: (item: MediaItem) => void) =>
    subscribe<MediaItem>(IPC.jobMediaUpdate, callback),
  onJobLog: (callback: (entry: LogEntry) => void) =>
    subscribe<LogEntry>(IPC.jobLog, callback)
}

contextBridge.exposeInMainWorld('api', api)
