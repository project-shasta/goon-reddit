import { execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { Readable } from 'node:stream'
import { promisify } from 'node:util'
import type { ToolInfo, ToolsStatus } from '@shared/types'
import { getToolDirs } from './paths'
import type { SettingsStore } from './settings'

const execFileAsync = promisify(execFile)
const EXE = process.platform === 'win32' ? '.exe' : ''
export const FFMPEG_FILENAME = `ffmpeg${EXE}`
export const YTDLP_FILENAME = `yt-dlp${EXE}`

const YTDLP_URL = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${YTDLP_FILENAME}`
const YTDLP_SUMS_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS'

export class ToolManager {
  constructor(private readonly settings: SettingsStore) {}

  private candidateDirs(): string[] {
    const override = this.settings.get().toolsDir
    const dirs = getToolDirs()
    return override ? [path.resolve(override), ...dirs] : dirs
  }

  resolve(filename: string): string | null {
    for (const dir of this.candidateDirs()) {
      const candidate = path.join(dir, filename)
      try {
        fs.accessSync(candidate)
        return candidate
      } catch {
        // try next dir
      }
    }
    return null
  }

  ffmpegPath(): string | null {
    return this.resolve(FFMPEG_FILENAME)
  }

  ytdlpPath(): string | null {
    return this.resolve(YTDLP_FILENAME)
  }

  async status(): Promise<ToolsStatus> {
    const [ffmpeg, ytdlp] = await Promise.all([
      this.describe('ffmpeg', this.ffmpegPath(), ['-version']),
      this.describe('yt-dlp', this.ytdlpPath(), ['--version'])
    ])
    return {
      toolsDir: this.candidateDirs()[0] ?? '',
      ffmpeg,
      ytdlp
    }
  }

  private async describe(
    name: ToolInfo['name'],
    file: string | null,
    args: string[]
  ): Promise<ToolInfo> {
    if (!file) return { name, path: null, version: null, ok: false }
    try {
      const { stdout } = await execFileAsync(file, args, {
        timeout: 15000,
        windowsHide: true,
        maxBuffer: 1024 * 1024
      })
      const version = stdout.split(/\r?\n/)[0]?.trim() ?? null
      return { name, path: file, version, ok: true }
    } catch {
      return { name, path: file, version: null, ok: false }
    }
  }

  async updateYtDlp(): Promise<ToolsStatus> {
    const targetDir = this.candidateDirs()[0]
    if (!targetDir) throw new Error('No tools directory configured.')

    const destination = path.join(targetDir, YTDLP_FILENAME)
    const res = await fetch(YTDLP_URL, {
      redirect: 'follow',
      headers: { 'User-Agent': 'reddit-downloader/0.1' }
    })
    if (!res.ok || !res.body) {
      throw new Error(`yt-dlp download failed: HTTP ${res.status} ${res.statusText}`)
    }

    const tmp = `${destination}.download`
    const file = createWriteStream(tmp)
    const hash = createHash('sha256')

    try {
      for await (const chunk of Readable.fromWeb(res.body as never)) {
        hash.update(chunk as Buffer)
        if (!file.write(chunk)) {
          await new Promise((resolve) => file.once('drain', resolve))
        }
      }
      await new Promise<void>((resolve, reject) =>
        file.end((err: Error | null | undefined) => (err ? reject(err) : resolve()))
      )
    } catch (err) {
      file.destroy()
      await fsPromises.unlink(tmp).catch(() => undefined)
      throw err
    }

    const actual = hash.digest('hex')
    try {
      const sums = await fetch(YTDLP_SUMS_URL, {
        redirect: 'follow',
        headers: { 'User-Agent': 'reddit-downloader/0.1' }
      })
      if (sums.ok) {
        const text = await sums.text()
        const line = text
          .split(/\r?\n/)
          .find((entry) => entry.trim().split(/\s+/).pop() === YTDLP_FILENAME)
        if (line) {
          const expected = line.trim().split(/\s+/)[0].toLowerCase()
          if (expected !== actual.toLowerCase()) {
            await fsPromises.unlink(tmp).catch(() => undefined)
            throw new Error('yt-dlp checksum mismatch')
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('checksum')) {
        await fsPromises.unlink(tmp).catch(() => undefined)
        throw err
      }
      // Checksum endpoint unavailable: keep the downloaded binary.
    }

    await fsPromises.rename(tmp, destination)
    if (process.platform !== 'win32') await fsPromises.chmod(destination, 0o755)

    // Update status
    return this.status()
  }
}
