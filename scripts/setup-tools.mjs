#!/usr/bin/env node
/**
 * Downloads the external tools used by the app into ./tools so the app folder
 * stays self-contained and portable.
 *
 *   npm run tools:setup            # reuse existing binaries
 *   npm run tools:setup -- --force # download again
 */
import path from 'node:path'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import ffmpegStatic from 'ffmpeg-static'

const execFileAsync = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TOOLS_DIR = path.join(ROOT, 'tools')
const FORCE = process.argv.includes('--force')

const isWindows = process.platform === 'win32'
const YTDLP_ASSET = isWindows ? 'yt-dlp.exe' : 'yt-dlp'
const YTDLP_OUT = path.join(TOOLS_DIR, YTDLP_ASSET)
const FFMPEG_OUT = path.join(TOOLS_DIR, isWindows ? 'ffmpeg.exe' : 'ffmpeg')

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function versionOf(file, args) {
  try {
    const { stdout } = await execFileAsync(file, args, { timeout: 15000, windowsHide: true })
    return stdout.split(/\r?\n/)[0].trim()
  } catch {
    return null
  }
}

async function downloadFile(url, dest, label) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'reddit-downloader-tools-setup/1.0' }
  })
  if (!res.ok || !res.body) {
    throw new Error(`${label}: HTTP ${res.status} ${res.statusText}`)
  }

  const total = Number(res.headers.get('content-length')) || 0
  const tmp = `${dest}.download`
  const file = createWriteStream(tmp)
  const hash = createHash('sha256')
  let received = 0
  let lastLog = 0

  for await (const chunk of Readable.fromWeb(res.body)) {
    hash.update(chunk)
    received += chunk.length
    if (!file.write(chunk)) {
      await new Promise((resolve) => file.once('drain', resolve))
    }
    if (Date.now() - lastLog > 1500) {
      const pct = total ? ` (${Math.round((received / total) * 100)}%)` : ''
      process.stdout.write(`\r  ${label}: ${(received / 1024 / 1024).toFixed(1)} MB${pct}   `)
      lastLog = Date.now()
    }
  }

  await new Promise((resolve, reject) => {
    file.end((err) => (err ? reject(err) : resolve()))
  })
  process.stdout.write('\n')
  await fs.rename(tmp, dest)
  return hash.digest('hex')
}

async function verifyYtDlpChecksum(actualHash) {
  const res = await fetch(
    'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS',
    { redirect: 'follow', headers: { 'User-Agent': 'reddit-downloader-tools-setup/1.0' } }
  )
  if (!res.ok) {
    console.warn(`  warning: could not fetch checksums (HTTP ${res.status}); skipping verification`)
    return
  }
  const sums = await res.text()
  const line = sums
    .split(/\r?\n/)
    .find((entry) => entry.trim().split(/\s+/).pop() === YTDLP_ASSET)
  if (!line) {
    console.warn(`  warning: ${YTDLP_ASSET} missing from checksum file; skipping verification`)
    return
  }
  const expected = line.trim().split(/\s+/)[0].toLowerCase()
  if (expected !== actualHash.toLowerCase()) {
    throw new Error(`yt-dlp checksum mismatch (expected ${expected}, got ${actualHash})`)
  }
  console.log('  checksum verified')
}

async function setupFfmpeg(log) {
  if (!ffmpegStatic) throw new Error('ffmpeg-static binary is unavailable')
  if (!FORCE && (await exists(FFMPEG_OUT))) {
    const version = await versionOf(FFMPEG_OUT, ['-version'])
    log.push(`ffmpeg: already present (${version ?? 'unknown version'})`)
    return version
  }
  if (!ffmpegStatic || !(await exists(ffmpegStatic))) {
    throw new Error(
      'ffmpeg-static did not provide a binary. Run "npm install" again or download ffmpeg manually into tools/.'
    )
  }
  await fs.mkdir(TOOLS_DIR, { recursive: true })
  await fs.copyFile(ffmpegStatic, FFMPEG_OUT)
  const version = await versionOf(FFMPEG_OUT, ['-version'])
  log.push(`ffmpeg: copied to ${FFMPEG_OUT} (${version ?? 'unknown version'})`)
  return version
}

async function setupYtDlp(log) {
  if (!FORCE && (await exists(YTDLP_OUT))) {
    const version = await versionOf(YTDLP_OUT, ['--version'])
    log.push(`yt-dlp: already present (${version ?? 'unknown version'})`)
    return version
  }
  await fs.mkdir(TOOLS_DIR, { recursive: true })
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${YTDLP_ASSET}`
  console.log(`Downloading ${YTDLP_ASSET} from ${url}`)
  const hash = await downloadFile(url, YTDLP_OUT, YTDLP_ASSET)
  await verifyYtDlpChecksum(hash)
  if (!isWindows) await fs.chmod(YTDLP_OUT, 0o755)
  const version = await versionOf(YTDLP_OUT, ['--version'])
  log.push(`yt-dlp: downloaded to ${YTDLP_OUT} (${version ?? 'unknown version'})`)
  return version
}

async function main() {
  await fs.mkdir(TOOLS_DIR, { recursive: true })
  const log = []
  console.log(`Tools directory: ${TOOLS_DIR}`)

  const ffmpegVersion = await setupFfmpeg(log)
  const ytDlpVersion = await setupYtDlp(log)

  const versions = {
    fetchedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    ffmpeg: ffmpegVersion,
    ytDlp: ytDlpVersion
  }
  await fs.writeFile(path.join(TOOLS_DIR, 'versions.json'), JSON.stringify(versions, null, 2))
  await fs.writeFile(path.join(TOOLS_DIR, '.gitkeep'), '')

  for (const line of log) console.log(`- ${line}`)
  console.log('Tools are ready.')
}

main().catch((err) => {
  console.error(`\nTools setup failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
})
