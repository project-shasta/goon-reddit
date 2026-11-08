import { BrowserWindow, type Session } from 'electron'
import { RedditError } from './errors'
import { buildListingRequests, buildUserListingRequests } from './listing'

export const REDDIT_BASE = 'https://www.reddit.com'
export const REDDIT_PARTITION = 'persist:reddit'
export const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

export type RedditPost = Record<string, any>

export interface RedditResponse {
  status: number
  contentType: string
  finalUrl: string
  text: string
}

interface PageFetchResult extends RedditResponse {
  ok: true
}

interface PageFetchFailure {
  ok: false
  error: string
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function looksLikeHtml(res: RedditResponse): boolean {
  if (res.contentType.toLowerCase().includes('text/html')) return true
  const start = res.text.trimStart().slice(0, 1)
  return start === '<'
}

function looksLikeLogin(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.pathname.startsWith('/login') || parsed.pathname.startsWith('/register')
  } catch {
    return false
  }
}

function bodySnippet(text: string, max = 300): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * Thin client around the logged-in Reddit web session.
 *
 * The primary transport is Chromium's fetch through the persisted partition.
 * If Reddit answers with its HTML "Blocked" page, we retry the same URL from
 * inside a hidden reddit.com page so the request carries real browser headers,
 * origin, cookies and TLS fingerprint.
 */
export class RedditClient {
  private hiddenWindow: BrowserWindow | null = null
  private hiddenLoading: Promise<BrowserWindow> | null = null
  private nextRequestAt = 0
  private pauseUntil = 0

  constructor(private readonly session: Session) {}

  private async throttle(signal?: AbortSignal): Promise<void> {
    const now = Date.now()
    const target = Math.max(this.nextRequestAt, this.pauseUntil)
    if (target > now) await sleep(target - now, signal)
    this.nextRequestAt = Date.now() + 1100 + Math.random() * 400
  }

  private async fetchDirect(pathOrUrl: string, signal?: AbortSignal): Promise<RedditResponse> {
    const url = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : `${REDDIT_BASE}${pathOrUrl}`
    const res = await this.session.fetch(url, {
      method: 'GET',
      credentials: 'include',
      redirect: 'follow',
      signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: `${REDDIT_BASE}/`
      }
    })
    const text = await res.text()

    const remaining = Number(res.headers.get('x-ratelimit-remaining'))
    const reset = Number(res.headers.get('x-ratelimit-reset'))
    if (Number.isFinite(remaining) && remaining <= 1 && Number.isFinite(reset)) {
      this.pauseUntil = Date.now() + Math.min(Math.max(reset, 1), 60) * 1000
    }

    return {
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      finalUrl: res.url || url,
      text
    }
  }

  private async ensureHiddenWindow(): Promise<BrowserWindow> {
    if (this.hiddenWindow && !this.hiddenWindow.isDestroyed()) return this.hiddenWindow
    if (this.hiddenLoading) return this.hiddenLoading

    this.hiddenLoading = (async () => {
      const win = new BrowserWindow({
        show: false,
        width: 1200,
        height: 900,
        webPreferences: {
          session: this.session,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: false
        }
      })
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      win.webContents.on('will-navigate', (event, url) => {
        try {
          const host = new URL(url).hostname
          if (host !== 'reddit.com' && !host.endsWith('.reddit.com')) {
            event.preventDefault()
          }
        } catch {
          event.preventDefault()
        }
      })

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out loading reddit.com')), 45000)
        const done = (): void => {
          clearTimeout(timer)
          resolve()
        }
        win.webContents.once('did-finish-load', done)
        win.webContents.once(
          'did-fail-load',
          (_event, code, description, _url, isMainFrame) => {
            if (!isMainFrame) return
            clearTimeout(timer)
            reject(new Error(`Could not load reddit.com (${code}: ${description})`))
          }
        )
        win.loadURL(`${REDDIT_BASE}/`).catch((err) => {
          clearTimeout(timer)
          reject(err)
        })
      })

      this.hiddenWindow = win
      return win
    })()

    try {
      return await this.hiddenLoading
    } finally {
      this.hiddenLoading = null
    }
  }

  private async pageFetch(path: string, signal?: AbortSignal): Promise<RedditResponse> {
    const win = await this.ensureHiddenWindow()
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const target = path.startsWith('http') ? path : `${REDDIT_BASE}${path}`
    const script = `(async () => {
      try {
        const response = await fetch(${JSON.stringify(target)}, {
          credentials: 'include',
          headers: { 'Accept': 'application/json, text/plain, */*' }
        });
        const text = await response.text();
        return {
          ok: true,
          status: response.status,
          contentType: response.headers.get('content-type') || '',
          finalUrl: response.url,
          text
        };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    })()`

    const result = (await Promise.race([
      win.webContents.executeJavaScript(script, true),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('Timed out fetching from reddit.com page')), 45000)
      )
    ])) as PageFetchResult | PageFetchFailure

    if (!result.ok) {
      throw new RedditError('NETWORK', `Reddit page fetch failed: ${result.error}`)
    }
    return result
  }

  async get(path: string, signal?: AbortSignal): Promise<RedditResponse> {
    let lastError: unknown = null

    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      await this.throttle(signal)

      let res: RedditResponse
      try {
        res = await this.fetchDirect(path, signal)
      } catch (err) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        lastError = err
        await sleep(1200 * (attempt + 1), signal)
        continue
      }

      if (looksLikeLogin(res.finalUrl) || res.status === 401) {
        throw new RedditError(
          'AUTH_REQUIRED',
          'Your Reddit session is missing or expired. Log in on Reddit first.'
        )
      }

      if (res.status === 429) {
        const retryAfter = Number(res.text) || 5
        this.pauseUntil = Date.now() + Math.min(Math.max(retryAfter, 2), 60) * 1000
        lastError = new RedditError('RATE_LIMITED', 'Reddit rate limit reached.')
        continue
      }

      if (res.status >= 500) {
        lastError = new RedditError('UNKNOWN', `Reddit returned HTTP ${res.status}.`, res.status)
        await sleep(1500 * (attempt + 1), signal)
        continue
      }

      if (res.status === 403) {
        if (looksLikeHtml(res)) {
          // The direct Chromium fetch hit Reddit's block page. Retry from the
          // actual reddit.com page context before giving up.
          try {
            const pageRes = await this.pageFetch(path, signal)
            if (pageRes.status >= 200 && pageRes.status < 300) {
              this.nextRequestAt = Date.now() + 1100
              return pageRes
            }
          } catch (err) {
            if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
            lastError = err
          }
          throw new RedditError(
            'BLOCKED',
            'Reddit blocked the request. Open the Reddit login window, make sure you are logged in, then try again.'
          )
        }
        throw new RedditError(
          'FORBIDDEN',
          `Reddit refused access to this subreddit. It may be private, quarantined, or require account opt-in.${res.text ? ` (${bodySnippet(res.text)})` : ''}`,
          403
        )
      }

      if (res.status === 404) {
        throw new RedditError('NOT_FOUND', 'Subreddit or post not found.', 404)
      }
      if (res.status === 451) {
        throw new RedditError('UNAVAILABLE', 'This content is unavailable for legal reasons.', 451)
      }
      if (res.status >= 400) {
        throw new RedditError(
          'UNKNOWN',
          `Reddit returned HTTP ${res.status}. ${bodySnippet(res.text)}`,
          res.status
        )
      }

      return res
    }

    if (lastError instanceof RedditError) throw lastError
    throw new RedditError('NETWORK', 'Could not reach Reddit. Check your connection and try again.')
  }

  async getJson<T = any>(path: string, signal?: AbortSignal): Promise<T> {
    const res = await this.get(path, signal)
    try {
      return JSON.parse(res.text) as T
    } catch {
      throw new RedditError(
        'BLOCKED',
        'Reddit returned a non-JSON response. Your session may need verification; open the Reddit login window and try again.'
      )
    }
  }

  async me(): Promise<{ name: string } | null> {
    // Reddit's `/api/v1/me.json` now answers with only a `features` object for
    // browser sessions, so ask the profile endpoint first and keep the classic
    // endpoint as a fallback for accounts/API responses that still include it.
    const candidates: Array<{ path: string; pick: (json: any) => unknown }> = [
      { path: '/user/me/about.json', pick: (json) => json?.data?.name },
      { path: '/api/v1/me.json', pick: (json) => json?.name }
    ]

    for (const candidate of candidates) {
      try {
        const json = await this.getJson<any>(candidate.path)
        const name = candidate.pick(json)
        if (typeof name === 'string' && name) return { name }
      } catch {
        // Try the next endpoint; the caller treats null as "not confirmed".
      }
    }

    return null
  }

  /**
   * Reddit's edge blocks the literal `/r/<sub>/new.json` path for logged-in
   * browsers, so try the sorted listing first and fall through to alternates.
   * Only listing-specific failures advance the chain; auth/rate-limit errors
   * stop immediately because another URL will not fix them.
   */
  private async getListingPage(
    subreddit: string,
    after: string | null,
    signal?: AbortSignal,
    sortOrder: 'new' | 'hot' | 'top' | 'rising' = 'new'
  ): Promise<any> {
    let lastError: unknown = null

    for (const request of buildListingRequests(subreddit, after, 100, sortOrder)) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      try {
        return await this.getJson<any>(request.url, signal)
      } catch (err) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        if (err instanceof RedditError && err.code === 'AUTH_REQUIRED') throw err
        if (
          err instanceof RedditError &&
          (err.code === 'BLOCKED' || err.code === 'FORBIDDEN' || err.code === 'NOT_FOUND')
        ) {
          lastError = err
          continue
        }
        throw err
      }
    }

    if (lastError instanceof RedditError) throw lastError
    throw new RedditError('UNKNOWN', 'Reddit returned an unexpected listing response.')
  }

  /**
   * User archive listing: `/user/{username}/submitted.json`.
   * Returns posts submitted by a specific user across all subreddits.
   */
  private async getUserListingPage(
    username: string,
    after: string | null,
    signal?: AbortSignal,
    sortOrder: 'new' | 'hot' | 'top' | 'rising' = 'new'
  ): Promise<any> {
    let lastError: unknown = null

    for (const request of buildUserListingRequests(username, after, 100, sortOrder)) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      try {
        return await this.getJson<any>(request.url, signal)
      } catch (err) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        if (err instanceof RedditError && err.code === 'AUTH_REQUIRED') throw err
        if (
          err instanceof RedditError &&
          (err.code === 'BLOCKED' || err.code === 'FORBIDDEN' || err.code === 'NOT_FOUND')
        ) {
          lastError = err
          continue
        }
        throw err
      }
    }

    if (lastError instanceof RedditError) throw lastError
    throw new RedditError('UNKNOWN', 'Reddit returned an unexpected listing response.')
  }

  async *pages(
    subreddit: string,
    options: { signal?: AbortSignal; sortOrder?: 'new' | 'hot' | 'top' | 'rising' } = {}
  ): AsyncGenerator<{ posts: RedditPost[]; after: string | null }> {
    let after: string | null = null
    let previousAfter: string | null = null

    for (let page = 0; page < 10000; page++) {
      const json = await this.getListingPage(subreddit, after, options.signal, options.sortOrder)
      const children = json?.data?.children

      if (!Array.isArray(children)) {
        throw new RedditError('UNKNOWN', 'Reddit returned an unexpected listing response.')
      }

      const posts = children
        .map((child: any) => child?.data)
        .filter((post: unknown): post is RedditPost => Boolean(post))

      after = typeof json?.data?.after === 'string' ? json.data.after : null
      yield { posts, after }

      if (!after || posts.length === 0) return
      if (after === previousAfter) return
      previousAfter = after
      await sleep(1100 + Math.random() * 400, options.signal)
    }
  }

  /**
   * Iterate through a user's submitted posts (user archive).
   * Returns posts in the same format as `pages()`.
   */
  async *userPages(
    username: string,
    options: { signal?: AbortSignal; sortOrder?: 'new' | 'hot' | 'top' | 'rising' } = {}
  ): AsyncGenerator<{ posts: RedditPost[]; after: string | null }> {
    let after: string | null = null
    let previousAfter: string | null = null

    for (let page = 0; page < 10000; page++) {
      const json = await this.getUserListingPage(username, after, options.signal, options.sortOrder)
      const children = json?.data?.children

      if (!Array.isArray(children)) {
        throw new RedditError('UNKNOWN', 'Reddit returned an unexpected listing response.')
      }

      const posts = children
        .map((child: any) => child?.data)
        .filter((post: unknown): post is RedditPost => Boolean(post))

      after = typeof json?.data?.after === 'string' ? json.data.after : null
      yield { posts, after }

      if (!after || posts.length === 0) return
      if (after === previousAfter) return
      previousAfter = after
      await sleep(1100 + Math.random() * 400, options.signal)
    }
  }

  destroy(): void {
    if (this.hiddenWindow && !this.hiddenWindow.isDestroyed()) {
      this.hiddenWindow.destroy()
    }
    this.hiddenWindow = null
  }
}
