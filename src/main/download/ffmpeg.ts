import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface FfmpegOptions {
  duration: number | null
  signal: AbortSignal
  onProgress?: (ratio: number | null) => void
}

/**
 * Download a DASH/HLS manifest and remux its streams into an MP4.
 * Reddit serves video and audio as separate DASH tracks, so this is the
 * reliable way to keep audio.
 */
export async function downloadWithFfmpeg(
  ffmpegPath: string,
  url: string,
  destination: string,
  options: FfmpegOptions
): Promise<{ bytes: number }> {
  await fs.mkdir(path.dirname(destination), { recursive: true })
  const temp = `${destination}.part.mp4`
  await fs.unlink(temp).catch(() => undefined)

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-y',
    // Some media CDNs reject ffmpeg's default Lavf user agent.
    '-user_agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    '-i',
    url,
    '-c',
    'copy',
    '-progress',
    'pipe:1',
    '-nostats',
    temp
  ]

  let stderr = ''
  let killed = false

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true })

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
        const match = /^out_time_(?:us|ms)=(\d+)$/.exec(line.trim())
        if (match && options.duration && options.duration > 0) {
          const micros = Number(match[1])
          const ratio = Math.min(1, micros / 1_000_000 / options.duration)
          options.onProgress?.(ratio)
        }
      }
    })

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000)
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
        reject(new Error(`ffmpeg exited with code ${code}. ${stderr.trim().slice(-800)}`))
      }
    })
  }).catch(async (err) => {
    await fs.unlink(temp).catch(() => undefined)
    throw err
  })

  const stat = await fs.stat(temp).catch(() => null)
  if (!stat || stat.size === 0) {
    await fs.unlink(temp).catch(() => undefined)
    throw new Error('ffmpeg produced an empty file')
  }

  await fs.rename(temp, destination)
  options.onProgress?.(1)
  return { bytes: stat.size }
}
