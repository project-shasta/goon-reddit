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

/** Download a supported external video URL with yt-dlp. */
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

  try {
    await new Promise<void>((resolve, reject) => {
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
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`yt-dlp exited with code ${code}. ${stderr.trim().slice(-1200)}`))
        }
      })
    })
  } catch (err) {
    await cleanupPartials(dir, base)
    throw err
  }

  let output: string | null = printedPath
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
}
