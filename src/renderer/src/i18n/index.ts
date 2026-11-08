import { useMemo } from 'react'
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

const translations: Record<LanguageId, Translation> = {
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
  enSimple
}

const languageNames: Record<LanguageId, string> = {
  en: 'English',
  de: 'Deutsch',
  uk: 'Українська',
  zh: '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
  pirate: '🏴‍☠️ Pirate',
  cyberpunk: '⚡ Cyberpunk',
  eo: 'Esperanto',
  enSimple: 'Easy English'
}

export function useI18n(language: LanguageId): Translation {
  return useMemo(() => translations[language] ?? en, [language])
}

export function languageLabel(id: LanguageId): string {
  return languageNames[id] ?? id
}

export const languageIds = Object.keys(translations) as LanguageId[]
