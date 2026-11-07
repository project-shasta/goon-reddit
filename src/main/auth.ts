import { BrowserWindow, session, shell, type Session } from 'electron'
import type { AuthStatus } from '@shared/types'
import { CHROME_UA, REDDIT_PARTITION, RedditClient } from './reddit/client'

export class AuthManager {
  readonly session: Session
  readonly client: RedditClient

  private status: AuthStatus = {
    loggedIn: false,
    username: null,
    checking: true,
    message: null
  }
  private loginWindow: BrowserWindow | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private pollBusy = false
  private lastCheck = 0
  private refreshing: Promise<AuthStatus> | null = null

  constructor(private readonly emit: (status: AuthStatus) => void) {
    this.session = session.fromPartition(REDDIT_PARTITION)
    this.session.setUserAgent(CHROME_UA)
    this.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
    this.client = new RedditClient(this.session)
  }

  getStatus(): AuthStatus {
    return { ...this.status }
  }

  private setStatus(status: AuthStatus): void {
    this.status = status
    this.emit(this.getStatus())
  }

  async refresh(force = false): Promise<AuthStatus> {
    if (this.refreshing) return this.refreshing
    if (!force && Date.now() - this.lastCheck < 15000 && !this.status.checking) {
      return this.getStatus()
    }

    this.refreshing = (async () => {
      if (!this.status.loggedIn) {
        this.setStatus({ ...this.status, checking: true, message: null })
      }

      try {
        const cookies = await this.session.cookies.get({ url: 'https://www.reddit.com/' })
        const hasSession = cookies.some((cookie) => cookie.name === 'reddit_session')

        if (!hasSession) {
          this.setStatus({
            loggedIn: false,
            username: null,
            checking: false,
            message:
              this.loginWindow && !this.loginWindow.isDestroyed()
                ? 'Waiting for Reddit login…'
                : 'Not logged in.'
          })
          this.lastCheck = Date.now()
          return this.getStatus()
        }

        const me = await this.client.me()
        if (me) {
          this.setStatus({
            loggedIn: true,
            username: me.name,
            checking: false,
            message: null
          })
        } else {
          // The session cookie exists but Reddit would not confirm it (for
          // example a challenge or a temporary block). Let the user try
          // anyway; a real auth failure will surface during scanning.
          this.setStatus({
            loggedIn: true,
            username: this.status.username,
            checking: false,
            message:
              'A Reddit session cookie was found, but Reddit did not confirm it. If scanning fails, open the login window and sign in again.'
          })
        }
      } catch (err) {
        this.setStatus({
          loggedIn: false,
          username: null,
          checking: false,
          message: err instanceof Error ? err.message : 'Could not check the Reddit session.'
        })
      } finally {
        this.lastCheck = Date.now()
      }

      return this.getStatus()
    })()

    try {
      return await this.refreshing
    } finally {
      this.refreshing = null
    }
  }

  async openLogin(): Promise<void> {
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.show()
      this.loginWindow.focus()
      return
    }

    const win = new BrowserWindow({
      width: 1080,
      height: 820,
      minWidth: 700,
      minHeight: 560,
      show: true,
      autoHideMenuBar: true,
      title: 'Log in on Reddit',
      backgroundColor: '#0f1115',
      webPreferences: {
        session: this.session,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    this.loginWindow = win

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            webPreferences: {
              session: this.session,
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true
            }
          }
        }
      }
      void shell.openExternal(url).catch(() => undefined)
      return { action: 'deny' }
    })

    win.webContents.on('will-navigate', (event, url) => {
      if (!/^https?:/i.test(url)) event.preventDefault()
    })
    win.webContents.on('will-attach-webview', (event) => event.preventDefault())

    win.on('closed', () => {
      this.loginWindow = null
      this.stopPolling()
      void this.refresh(true)
    })

    this.setStatus({
      ...this.status,
      checking: false,
      message: 'Waiting for Reddit login…'
    })

    await win.loadURL('https://www.reddit.com/login/')
    this.startPolling()
  }

  private startPolling(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => {
      void this.checkLogin()
    }, 2000)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private async checkLogin(): Promise<void> {
    if (this.pollBusy) return
    if (!this.loginWindow || this.loginWindow.isDestroyed()) return

    this.pollBusy = true
    try {
      const cookies = await this.session.cookies.get({ url: 'https://www.reddit.com/' })
      if (!cookies.some((cookie) => cookie.name === 'reddit_session')) return

      const me = await this.client.me()
      if (!me) return

      this.lastCheck = Date.now()
      this.setStatus({
        loggedIn: true,
        username: me.name,
        checking: false,
        message: null
      })
      this.stopPolling()
      setTimeout(() => {
        if (this.loginWindow && !this.loginWindow.isDestroyed()) this.loginWindow.close()
      }, 900)
    } catch {
      // Keep waiting; the user may still be solving a challenge or entering 2FA.
    } finally {
      this.pollBusy = false
    }
  }

  async logout(): Promise<void> {
    this.stopPolling()
    if (this.loginWindow && !this.loginWindow.isDestroyed()) this.loginWindow.close()
    this.loginWindow = null

    this.client.destroy()
    await this.session.clearStorageData()
    await this.session.clearCache()

    this.lastCheck = Date.now()
    this.setStatus({
      loggedIn: false,
      username: null,
      checking: false,
      message: 'Logged out.'
    })
  }

  destroy(): void {
    this.stopPolling()
    if (this.loginWindow && !this.loginWindow.isDestroyed()) this.loginWindow.destroy()
    this.loginWindow = null
    this.client.destroy()
  }
}
