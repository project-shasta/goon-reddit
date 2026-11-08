import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { translations, translationFor } from '../src/renderer/src/i18n/catalog'
import { en } from '../src/renderer/src/i18n/en'
import type { LanguageId } from '../src/renderer/src/i18n/types'

const RENDERER_ROOT = resolve(process.cwd(), 'src/renderer/src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

interface Usage {
  key: string
  file: string
  line: number
}

function collectUsages(pattern: RegExp): Usage[] {
  const usages: Usage[] = []

  for (const file of sourceFiles(RENDERER_ROOT)) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(line)) !== null) {
        usages.push({
          key: match[1],
          file: relative(RENDERER_ROOT, file),
          line: index + 1
        })
      }
    })
  }

  return usages
}

function describeUsages(usages: Usage[]): string[] {
  return usages.map(({ key, file, line }) => `${key} (${file}:${line})`)
}

// `t.foo` but not `event.target` or `result.t.foo`.
const TRANSLATION_USAGE = /(?<![\w.])t\.([A-Za-z_]\w*)/g
// `t.foo as (n: number) => string` style calls will crash when foo is a string.
const FUNCTION_CAST = /(?<![\w.])t\.([A-Za-z_]\w*)\s+as\s+\(/g

describe('renderer translations', () => {
  it('defines every key the renderer reads', () => {
    const usages = collectUsages(TRANSLATION_USAGE)
    expect(usages.length).toBeGreaterThan(0)

    const missing = usages.filter(({ key }) => typeof en[key] === 'undefined')

    expect(describeUsages(missing)).toEqual([])
  })

  it('defines every key the renderer calls as a function', () => {
    const usages = collectUsages(FUNCTION_CAST)
    expect(usages.length).toBeGreaterThan(0)

    const missing = usages.filter(({ key }) => typeof en[key] !== 'function')

    expect(describeUsages(missing)).toEqual([])
  })

  it('falls back to English for keys a locale has not translated', () => {
    const usedKeys = [...new Set(collectUsages(TRANSLATION_USAGE).map(({ key }) => key))]

    for (const language of Object.keys(translations) as LanguageId[]) {
      const dictionary = translationFor(language)
      const missing = usedKeys.filter((key) => typeof dictionary[key] === 'undefined')

      expect(missing, `locale ${language}`).toEqual([])
    }
  })

  it('keeps locale translations when they exist', () => {
    expect(translationFor('de').settings).toBe('Einstellungen')
  })

  it('keeps function keys callable in every locale', () => {
    const functionKeys = [...new Set(collectUsages(FUNCTION_CAST).map(({ key }) => key))]

    for (const language of Object.keys(translations) as LanguageId[]) {
      const dictionary = translationFor(language)
      const broken = functionKeys.filter((key) => typeof dictionary[key] !== 'function')

      expect(broken, `locale ${language}`).toEqual([])
    }
  })
})
