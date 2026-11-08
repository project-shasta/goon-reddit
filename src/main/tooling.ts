import { execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { inflateSync, gunzipSync } from 'node:zlib'
import path from 'node:path'
import { Readable } from 'node:stream'
import { promisify } from 'node:util'
import type { ToolInfo, ToolsStatus } from '@shared/types'
import { getPreferredWritableToolDir, getToolDirs } from './paths'
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
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('node:fs').accessSync(candidate)
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

  private async downloadYtDlp(targetDir: string): Promise<string> {
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
      await fs.unlink(tmp).catch(() => undefined)
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
            await fs.unlink(tmp).catch(() => undefined)
            throw new Error('yt-dlp checksum mismatch')
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('checksum')) {
        await fs.unlink(tmp).catch(() => undefined)
        throw err
      }
      // Checksum endpoint unavailable: keep the downloaded binary.
    }

    await fs.rename(tmp, destination)
    if (process.platform !== 'win32') await fs.chmod(destination, 0o755)
    return destination
  }

  private async downloadFfmpeg(targetDir: string): Promise<string> {
    const destination = path.join(targetDir, FFMPEG_FILENAME)
    const isWin = process.platform === 'win32'
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'

    // Fetch the latest release tag from GitHub (the "latest" redirect gives us the actual tag)
    const releasesUrl = 'https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/tag/latest'
    const releasesRes = await fetch(releasesUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'reddit-downloader/0.1' }
    })
    if (!releasesRes.ok) {
      throw new Error(`Could not fetch latest FFmpeg release: HTTP ${releasesRes.status}`)
    }
    // Final URL looks like: .../releases/tag/autobuild-2024-...
    const finalUrl = releasesRes.url
    // Extract the release tag from the redirect URL (e.g., /releases/tag/autobuild-2024-...)
    const tagMatch = finalUrl.match(/\/releases\/tag\/([^/?]+)/)
    const tag = tagMatch ? tagMatch[1] : null
    if (!tag) {
      console.warn('FFmpeg release URL:', finalUrl)
      throw new Error('Could not parse FFmpeg release tag from GitHub URL')
    }

    // Build the actual download URL with the real tag
    // Platform prefixes: win64, winarm64, linux64, linuxarm64, macosx64, macosxarm64
    const ext = isWin ? 'zip' : 'tar.xz'
    const platformPrefix = isWin
      ? arch === 'arm64' ? 'winarm64' : 'win64'
      : process.platform === 'darwin'
        ? arch === 'arm64' ? 'macosxarm64' : 'macosx64'
        : arch === 'arm64' ? 'linuxarm64' : 'linux64'
    const archiveUrl = `https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/${tag}/ffmpeg-master-latest-${platformPrefix}-gpl.${ext}`

    const res = await fetch(archiveUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'reddit-downloader/0.1' }
    })
    if (!res.ok || !res.body) {
      throw new Error(`ffmpeg download failed: HTTP ${res.status} ${res.statusText}`)
    }

    const tmpArchive = `${destination}.archive`
    const file = createWriteStream(tmpArchive)

    try {
      for await (const chunk of Readable.fromWeb(res.body as never)) {
        if (!file.write(chunk)) {
          await new Promise((resolve) => file.once('drain', resolve))
        }
      }
      await new Promise<void>((resolve, reject) =>
        file.end((err: Error | null | undefined) => (err ? reject(err) : resolve()))
      )
    } catch (err) {
      file.destroy()
      await fs.unlink(tmpArchive).catch(() => undefined)
      throw err
    }

    // Extract ffmpeg from the archive
    if (isWin) {
      await this.extractFfmpegFromZip(tmpArchive, destination)
    } else {
      await this.extractFfmpegFromTarXz(tmpArchive, destination)
    }

    await fs.unlink(tmpArchive).catch(() => undefined)
    return destination
  }

  private async extractFfmpegFromZip(archivePath: string, destination: string): Promise<void> {
    const data = await fs.readFile(archivePath)
    let offset = 0

    while (offset < data.length) {
      const signature = data.readUInt32LE(offset)
      if (signature !== 0x04034b50) break // local file header signature

      const method = data.readUInt16LE(offset + 8)
      const compressedSize = data.readUInt32LE(offset + 20)
      const fileNameLength = data.readUInt16LE(offset + 26)
      const extraFieldLength = data.readUInt16LE(offset + 28)
      const commentLength = data.readUInt16LE(offset + 30)

      const fileName = data.subarray(offset + 30, offset + 30 + fileNameLength).toString('utf-8')
      const fileOffset = offset + 30 + fileNameLength + extraFieldLength + commentLength

      // Look for the ffmpeg binary anywhere in the archive (path may vary across releases)
      const normalizedName = fileName.replace(/\\/g, '/')
      if (normalizedName.endsWith(`/${FFMPEG_FILENAME}`) || normalizedName === FFMPEG_FILENAME) {
        const compressedData = data.subarray(fileOffset, fileOffset + compressedSize)

        let decompressed: Buffer
        if (method === 0) {
          // Stored (no compression)
          decompressed = compressedData
        } else if (method === 8) {
          // Deflate compression
          try {
            decompressed = inflateSync(compressedData)
          } catch {
            // If decompression fails, use the compressed data as-is
            decompressed = compressedData
          }
        } else {
          decompressed = compressedData
        }

        await fs.writeFile(destination, decompressed)
        return
      }

      offset += 30 + fileNameLength + extraFieldLength + commentLength + compressedSize
    }

    throw new Error('ffmpeg binary not found in zip archive')
  }

  private async extractFfmpegFromTarXz(archivePath: string, destination: string): Promise<void> {
    const xzData = await fs.readFile(archivePath)
    const gunzipped = gunzipSync(xzData)

    // Parse the tar archive to find ffmpeg
    let offset = 0
    while (offset < gunzipped.length) {
      const name = gunzipped.subarray(offset, offset + 100).toString('utf-8').replace(/\0.*$/, '')

      if (name === '') break // end of archive

      const size = parseInt(gunzipped.subarray(offset + 124, offset + 136).toString('utf-8').trim(), 8)
      const fileOffset = offset + 512

      // Look for the ffmpeg binary anywhere in the archive (path may vary across releases)
      const normalizedName = name.replace(/\\/g, '/')
      if (normalizedName.endsWith(`/${FFMPEG_FILENAME}`) || normalizedName === FFMPEG_FILENAME) {
        const fileData = gunzipped.subarray(fileOffset, fileOffset + size)
        await fs.writeFile(destination, fileData)
        return
      }

      // Move to the next entry (tar uses 512-byte blocks)
      const blockAlignedSize = Math.ceil(size / 512) * 512
      offset += 512 + blockAlignedSize
    }

    throw new Error('ffmpeg binary not found in tar archive')
  }

  private async ensureWritableDir(currentPath: string | null): Promise<string> {
    if (currentPath) {
      const dir = path.dirname(currentPath)
      try {
        await fs.access(dir, fs.constants.W_OK)
        return dir
      } catch {
        // fall through
      }
    }
    return getPreferredWritableToolDir(this.settings.get().toolsDir)
  }

  async downloadTool(tool: 'ffmpeg' | 'yt-dlp'): Promise<ToolsStatus> {
    const isFfmpeg = tool === 'ffmpeg'
    const current = isFfmpeg ? this.ffmpegPath() : this.ytdlpPath()
    const targetDir = await this.ensureWritableDir(current)

    await fs.mkdir(targetDir, { recursive: true })

    if (isFfmpeg) {
      await this.downloadFfmpeg(targetDir)
    } else {
      await this.downloadYtDlp(targetDir)
    }

    // Update versions.json so we can track what's installed
    await this.writeVersionInfo(targetDir)
    return this.status()
  }

  async updateYtDlp(): Promise<ToolsStatus> {
    const targetDir = await this.ensureWritableDir(this.ytdlpPath())
    await this.downloadYtDlp(targetDir)
    await this.writeVersionInfo(targetDir)
    return this.status()
  }

  private async writeVersionInfo(targetDir: string): Promise<void> {
    const [ffmpegInfo, ytdlpInfo] = await Promise.all([
      this.describe('ffmpeg', this.ffmpegPath(), ['-version']),
      this.describe('yt-dlp', this.ytdlpPath(), ['--version'])
    ])
    const versionInfo = {
      fetchedAt: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      ffmpeg: ffmpegInfo.version,
      ytDlp: ytdlpInfo.version
    }
    await fs.writeFile(path.join(targetDir, 'versions.json'), JSON.stringify(versionInfo, null, 2))
  }
}
