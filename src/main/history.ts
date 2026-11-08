import fs from 'node:fs'
import path from 'node:path'
import { getDataDir } from './paths'

const KNOWN_FILE = () => path.join(getDataDir(), '.known')

/** Simple history store: one line per subreddit, post IDs space-separated. */
export class HistoryStore {
  private history: Map<string, Set<string>>

  constructor() {
    this.history = this.load()
  }

  private load(): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>()
    try {
      const raw = fs.readFileSync(KNOWN_FILE(), 'utf8').trim()
      if (!raw) return map
      for (const line of raw.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const parts = trimmed.split(/\s+/)
        if (parts.length < 2) continue
        const subreddit = parts[0]
        const postIds = new Set<string>(parts.slice(1))
        map.set(subreddit, postIds)
      }
    } catch {
      // File doesn't exist or is malformed — start fresh.
    }
    return map
  }

  private save(): void {
    const lines: string[] = []
    for (const [subreddit, postIds] of this.history) {
      if (postIds.size > 0) {
        lines.push(`${subreddit} ${[...postIds].join(' ')}`)
      }
    }
    const tmp = `${KNOWN_FILE()}.tmp`
    fs.writeFileSync(tmp, lines.join('\n') + (lines.length > 0 ? '\n' : ''), 'utf8')
    try { fs.renameSync(tmp, KNOWN_FILE()) } catch {
      // If rename fails (e.g., file in use), just overwrite.
      fs.writeFileSync(KNOWN_FILE(), lines.join('\n') + (lines.length > 0 ? '\n' : ''), 'utf8')
      try { fs.unlinkSync(tmp) } catch {}
    }
  }

  /** Check if a post ID has been downloaded for this subreddit. */
  has(subreddit: string, postId: string): boolean {
    const ids = this.history.get(subreddit.toLowerCase())
    return ids !== undefined && ids.has(postId)
  }

  /** Record that a post has been downloaded. */
  add(subreddit: string, postId: string): void {
    const key = subreddit.toLowerCase()
    if (!this.history.has(key)) {
      this.history.set(key, new Set<string>())
    }
    this.history.get(key)!.add(postId)
    this.save()
  }

  /** Get all known post IDs for a subreddit. */
  getPostIds(subreddit: string): Set<string> {
    return this.history.get(subreddit.toLowerCase()) ?? new Set<string>()
  }

  /** Clear history for a subreddit. */
  clear(subreddit: string): void {
    this.history.delete(subreddit.toLowerCase())
    this.save()
  }

  /** Get all post IDs across all subreddits. */
  getAllPostIds(): Array<Set<string>> {
    return [...this.history.values()]
  }

  /** Clear all known post IDs. */
  clearAll(): void {
    this.history.clear()
    this.save()
  }
}
