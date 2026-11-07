import { protocol } from 'electron'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { isPathInside } from './paths'

const allowedRoots = new Set<string>()

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
}

export function allowMediaRoot(directory: string): void {
  allowedRoots.add(path.resolve(directory))
}

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'rdm-media',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true
      }
    }
  ])
}

function isAllowed(file: string): boolean {
  for (const root of allowedRoots) {
    if (isPathInside(file, root)) return true
  }
  return false
}

export function installMediaProtocol(): void {
  protocol.handle('rdm-media', async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'local') {
        return new Response('Not found', { status: 404 })
      }
      const requested = url.searchParams.get('path')
      if (!requested) return new Response('Missing path', { status: 400 })

      const resolved = path.resolve(requested)
      if (!isAllowed(resolved)) {
        return new Response('Forbidden', { status: 403 })
      }

      const stat = await fs.stat(resolved).catch(() => null)
      if (!stat || !stat.isFile()) {
        return new Response('Not found', { status: 404 })
      }

      const stream = Readable.toWeb(createReadStream(resolved))
      return new Response(stream as never, {
        status: 200,
        headers: {
          'Content-Type': MIME_TYPES[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream',
          'Content-Length': String(stat.size),
          'Cache-Control': 'no-cache'
        }
      })
    } catch {
      return new Response('Internal error', { status: 500 })
    }
  })
}
