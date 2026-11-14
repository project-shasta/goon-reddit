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
import { notificationTranslations } from '@shared/i18n/notifications'

const notifications = notificationTranslations as unknown as Record<LanguageId, Translation>

export const translations: Record<LanguageId, Translation> = {
  en: { ...en, ...notifications.en },
  de: { ...de, ...notifications.de },
  uk: { ...uk, ...notifications.uk },
  zh: { ...zh, ...notifications.zh },
  'zh-TW': { ...zhTW, ...notifications['zh-TW'] },
  ja: { ...ja, ...notifications.ja },
  fr: { ...fr, ...notifications.fr },
  it: { ...it, ...notifications.it },
  es: { ...es, ...notifications.es },
  pirate: { ...pirate, ...notifications.pirate },
  cyberpunk: { ...cyberpunk, ...notifications.cyberpunk },
  eo: { ...eo, ...notifications.eo },
  enSimple: { ...enSimple, ...notifications.enSimple },
  matrix: { ...matrix, ...notifications.matrix }
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
