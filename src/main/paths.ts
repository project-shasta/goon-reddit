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

  // A truly portable app must write into its own directory. If we can't, fail
  // early rather than silently scattering data across the user's machine.
  throw new Error(
    `The app folder is not writable (${appData}). Move the app to a location where you have write access.`
  )
}

/** Profile folders that are pure caches and only slow the migration down. */
export const SKIPPED_PROFILE_DIRS = new Set([
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

    // Only copy settings.json if it has custom values (not just the old default
    // of 1000).  A fresh user who never changed maxPosts should get the new
    // default of 100.
    const settingsSrc = path.join(previousDir, 'settings.json')
    if (fs.existsSync(settingsSrc)) {
      try {
        const raw = JSON.parse(fs.readFileSync(settingsSrc, 'utf8')) as Record<string, unknown>
        // If maxPosts is 1000 (old default) and nothing else is set, skip it.
        if ((raw.maxPosts as number | undefined) === 1000) {
          // Check if there are any other custom values beyond the old defaults.
          const oldDefaults = {
            concurrency: 4,
            ytDlpDelayMs: 1500,
            includeImages: true,
            includeGalleries: true,
            includeVideos: true,
            includeExternalVideos: true,
            skipNsfw: false,
            skipExisting: true
          }
          const hasCustomValues = Object.entries(oldDefaults).some(
            ([key, val]) => (raw as Record<string, unknown>)[key] !== val
          )
          if (!hasCustomValues) {
            // All values match old defaults — skip migration, let new defaults apply.
          } else {
            copy('settings.json')
          }
        } else {
          copy('settings.json')
        }
      } catch {
        // Malformed settings.json — skip it.
      }
    }
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
 * Also override paths that default to %APPDATA% so nothing leaks out.
 */
export function configureUserData(): void {
  const previousDir = app.getPath('userData')
  const dataDir = getDataDir()
  app.setPath('userData', dataDir)
  app.setPath('logs', path.join(dataDir, 'logs'))
  app.setPath('crashDumps', path.join(dataDir, 'crashDumps'))
  app.setPath('sessionData', path.join(dataDir, 'sessionData'))
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
