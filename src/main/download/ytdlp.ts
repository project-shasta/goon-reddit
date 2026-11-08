import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface YtDlpOptions {
  ffmpegPath: string | null
  signal: AbortSignal
  onProgress?: (received: number, total: number | null) => void
}

export interface YtDlpResult {
  path: string
  bytes: number
}

function findOutputFile(dir: string, base: string): Promise<string | null> {
  return fs.readdir(dir).then((entries) => {
    const matches = entries
      .filter((entry) => entry.startsWith(`${base}.`) && !entry.endsWith('.part') && !entry.endsWith('.ytdl'))
      .sort()
    return matches.length > 0 ? path.join(dir, matches[matches.length - 1]) : null
  })
}

/** Remove temp/stream files yt-dlp leaves behind after a failed download. */
async function cleanupPartials(dir: string, base: string): Promise<void> {
  try {
    const entries = await fs.readdir(dir)
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.startsWith(`${base}.`)) return
        const partial =
          entry.endsWith('.part') ||
          entry.endsWith('.ytdl') ||
          entry.endsWith('.temp') ||
          /\.f[0-9a-z-]+\.[a-z0-9]+$/i.test(entry)
        if (partial) await fs.unlink(path.join(dir, entry)).catch(() => undefined)
      })
    )
  } catch {
    // Best effort only.
  }
}

/** Maximum number of retry attempts for transient yt-dlp errors. */
const MAX_RETRIES = 3

/** Base delay (ms) for exponential backoff between retries. */
const RETRY_BASE_DELAY_MS = 5000

/** Detect 429 / rate-limit or connection-reset errors in yt-dlp output. */
function isTransientError(stderr: string, code: number): boolean {
  if (code === 429) return true
  const lower = stderr.toLowerCase()
  return (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('connection reset') ||
    lower.includes('connection refused') ||
    lower.includes('temporary failure') ||
    lower.includes('server temporarily unavailable')
  )
}

/** Download a supported external video URL with yt-dlp. Retries transient errors with exponential backoff. */
export async function downloadWithYtDlp(
  ytdlpPath: string,
  url: string,
  outBase: string,
  options: YtDlpOptions
): Promise<YtDlpResult> {
  const dir = path.dirname(outBase)
  const base = path.basename(outBase)
  await fs.mkdir(dir, { recursive: true })

  const args = [
    '--no-warnings',
    '--no-colors',
    '--no-playlist',
    '--no-mtime',
    '--newline',
    '--progress',
    '--windows-filenames',
    '--trim-filenames',
    '150',
    // Prefer H.264 + AAC so the merged MP4 plays in Windows' built-in players,
    // then fall back to whatever the host offers.
    '-f',
    'bv*[vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
    '--merge-output-format',
    'mp4',
    '-o',
    `${outBase}.%(ext)s`,
    '--progress-template',
    'download:%(progress.downloaded_bytes)s|%(progress.total_bytes_estimate)s|%(progress._percent_str)s',
    '--print',
    'after_move:filepath'
  ]

  if (options.ffmpegPath) {
    args.push('--ffmpeg-location', path.dirname(options.ffmpegPath))
  }

  args.push(url)

  let stderr = ''
  let printedPath: string | null = null
  let killed = false

  const runYtDlp = (): Promise<{ code: number | null; stderr: string; printedPath: string | null }> =>
    new Promise<{ code: number | null; stderr: string; printedPath: string | null }>(
      (resolve, reject) => {
        const child = spawn(ytdlpPath, args, { windowsHide: true })
        const onAbort = (): void => {
          killed = true
          child.kill()
        }
        options.signal.addEventListener('abort', onAbort, { once: true })

        child.stdout.setEncoding('utf8')
        let buffer = ''
        child.stdout.on('data', (chunk: string) => {
          buffer += chunk
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const value = line.trim()
            if (!value) continue

            if (value.startsWith('download:')) {
              const [receivedRaw, totalRaw, percentRaw] = value.slice('download:'.length).split('|')
              const received = Number(receivedRaw)
              const total = Number(totalRaw)
              if (Number.isFinite(received)) {
                let estimatedTotal = Number.isFinite(total) && total > 0 ? total : null
                if (!estimatedTotal && percentRaw) {
                  const pct = Number(percentRaw.replace('%', '').trim())
                  if (Number.isFinite(pct) && pct > 0) estimatedTotal = Math.round((received / pct) * 100)
                }
                options.onProgress?.(received, estimatedTotal)
              }
              continue
            }

            if (/^[A-Za-z]:\\|^\//.test(value) || value.includes(`${path.sep}`)) {
              printedPath = value
            }
          }
        })

        child.stderr.setEncoding('utf8')
        child.stderr.on('data', (chunk: string) => {
          stderr = (stderr + chunk).slice(-6000)
        })

        child.on('error', (err) => {
          options.signal.removeEventListener('abort', onAbort)
          reject(err)
        })

        child.on('close', (code) => {
          options.signal.removeEventListener('abort', onAbort)
          if (killed || options.signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'))
            return
          }
          resolve({ code: code ?? -1, stderr, printedPath })
        })
      }
    )

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError')

    try {
      const { printedPath: attemptPrintedPath } = await runYtDlp()
      // Success — clean up and return.
      await cleanupPartials(dir, base)
      let output: string | null = attemptPrintedPath
      if (!output || !(await fs.stat(output).catch(() => null))) {
        output = await findOutputFile(dir, base)
      }
      if (!output) {
        await cleanupPartials(dir, base)
        throw new Error('yt-dlp finished but no output file was found')
      }

      const stat = await fs.stat(output)
      options.onProgress?.(stat.size, stat.size)
      return { path: output, bytes: stat.size }
    } catch (err) {
      // Don't retry if the user aborted.
      if (err instanceof Error && err.name === 'AbortError') throw err

      lastError = err instanceof Error ? err : new Error(String(err))

      // Only retry transient errors (429, rate limits, connection issues).
      if (attempt < MAX_RETRIES && isTransientError(lastError.message, 0)) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
        const jitter = Math.random() * 1000
        const wait = Math.round(delay + jitter)
        // Silent wait; the caller (job.ts) already logs retries for other
        // download paths, and yt-dlp retries are internal to this module.
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, wait)
          options.signal.addEventListener('abort', () => {
            clearTimeout(timer)
            resolve()
          }, { once: true })
        })
        continue
      }

      // Non-transient or max retries reached — clean partials and throw.
      await cleanupPartials(dir, base)
      throw lastError
    }
  }

  // Should not reach here, but just in case.
  await cleanupPartials(dir, base)
  throw lastError ?? new Error('yt-dlp failed after retries')
}
