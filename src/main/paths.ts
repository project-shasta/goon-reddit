import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

let cachedDataDir: string | null = null

/**
 * Everything the app writes lives next to the app itself:
 * - packaged: the folder that contains the executable
 * - portable: PORTABLE_EXECUTABLE_DIR (the stub runs from a temp folder)
 * - development: the project root
 */
function appRootDir(): string {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
  if (portableDir) return portableDir
  return app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()
}

function isWritableDirectory(candidate: string): boolean {
  try {
    fs.mkdirSync(candidate, { recursive: true })
    fs.accessSync(candidate, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

export function getDataDir(): string {
  if (cachedDataDir) return cachedDataDir

  const appData = path.join(appRootDir(), 'data')
  if (isWritableDirectory(appData)) {
    cachedDataDir = appData
    return cachedDataDir
  }

  // The app folder can be read-only if it was installed system-wide. Keep the
  // app usable in that case instead of failing to start.
  cachedDataDir = path.join(app.getPath('userData'), 'data')
  fs.mkdirSync(cachedDataDir, { recursive: true })
  console.warn('[data] app folder is not writable; falling back to', cachedDataDir)
  return cachedDataDir
}

/** Profile folders that are pure caches and only slow the migration down. */
const SKIPPED_PROFILE_DIRS = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'GrShaderCache',
  'ShaderCache',
  'blob_storage',
  'Service Worker'
])

/**
 * Copy settings and the Reddit login profile from the old APPDATA location the
 * first time the app runs with data stored next to the executable. The cookie
 * encryption key lives in `Local State`, so it has to move with the partition.
 */
function migrateLegacyProfile(previousDir: string, dataDir: string): void {
  try {
    if (path.resolve(previousDir) === path.resolve(dataDir)) return
    if (!fs.existsSync(previousDir)) return

    const alreadyMigrated =
      fs.existsSync(path.join(dataDir, 'Partitions', 'reddit', 'Network', 'Cookies')) ||
      fs.existsSync(path.join(dataDir, 'settings.json'))
    if (alreadyMigrated) return

    const copy = (relative: string, filter?: (source: string) => boolean): void => {
      const source = path.join(previousDir, relative)
      if (!fs.existsSync(source)) return
      fs.cpSync(source, path.join(dataDir, relative), {
        recursive: true,
        filter: filter ? (file) => filter(file) : undefined
      })
    }

    copy('settings.json')
    copy('Local State')

    const partition = path.join('Partitions', 'reddit')
    if (fs.existsSync(path.join(previousDir, partition))) {
      copy(partition, (source) => !SKIPPED_PROFILE_DIRS.has(path.basename(source)))
    }
  } catch (err) {
    console.warn('[data] could not migrate the previous profile:', err)
  }
}

/**
 * Must run before app.whenReady() and before any session is created, so
 * Chromium writes its whole profile (cookies, storage, caches) into data/.
 */
export function configureUserData(): void {
  const previousDir = app.getPath('userData')
  const dataDir = getDataDir()
  app.setPath('userData', dataDir)
  migrateLegacyProfile(previousDir, dataDir)
}

export function getToolDirs(): string[] {
  const dirs = [
    process.env.RDM_TOOLS_DIR,
    path.join(app.getAppPath(), 'tools'),
    path.join(path.dirname(app.getPath('exe')), 'tools'),
    path.join(process.resourcesPath, 'tools'),
    path.join(getDataDir(), 'tools')
  ].filter((dir): dir is string => Boolean(dir))

  return [...new Set(dirs.map((dir) => path.resolve(dir)))]
}

export function getPreferredWritableToolDir(override?: string | null): string {
  if (override) return path.resolve(override)

  for (const dir of getToolDirs()) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.accessSync(dir, fs.constants.W_OK)
      // Installed app resources are readable but not writable; keep looking.
      if (dir.includes('app.asar')) continue
      return dir
    } catch {
      // try next candidate
    }
  }

  const fallback = path.join(getDataDir(), 'tools')
  fs.mkdirSync(fallback, { recursive: true })
  return fallback
}

export function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}
