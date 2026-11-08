import type { LanguageId, Translation } from './types'
import { en } from './en'
import { de } from './de'
import { uk } from './uk'
import { zh } from './zh'
import { zhTW } from './zh-TW'
import { ja } from './ja'
import { fr } from './fr'
import { it } from './it'
import { es } from './es'
import { pirate } from './pirate'
import { cyberpunk } from './cyberpunk'
import { eo } from './e0'
import { enSimple } from './enSimple'
import { matrix } from './matrix'

export const translations: Record<LanguageId, Translation> = {
  en,
  de,
  uk,
  zh,
  'zh-TW': zhTW,
  ja,
  fr,
  it,
  es,
  pirate,
  cyberpunk,
  eo,
  enSimple,
  matrix
}

/**
 * Fall back to English for any key a locale has not translated yet.
 * Without this, a missing key reaches the renderer as `undefined` and can
 * turn into `undefined is not a function` crashes (or blank output).
 */
export function translationFor(language: LanguageId): Translation {
  const selected = translations[language]
  if (!selected || selected === en) return en
  return { ...en, ...selected }
}
