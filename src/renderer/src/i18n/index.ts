import { useMemo } from 'react'
import type { LanguageId, Translation } from './types'
import { translations, translationFor } from './catalog'

const languageNames: Record<LanguageId, string> = {
  en: '🇬🇧 English',
  de: '🇩🇪 Deutsch',
  uk: '🇺🇦 Українська',
  zh: '🇨🇳 简体中文',
  'zh-TW': '🇹🇼 繁體中文',
  ja: '🇯🇵 日本語',
  fr: '🇫🇷 Français',
  it: '🇮🇹 Italiano',
  es: '🇪🇸 Español',
  pirate: '🏴‍☠️ Pirate',
  cyberpunk: '⚡ Cyberpunk',
  eo: '🌐 Esperanto',
  enSimple: '📖 Easy English'
}

export function useI18n(language: LanguageId): Translation {
  return useMemo(() => translationFor(language), [language])
}

export function languageLabel(id: LanguageId): string {
  return languageNames[id] ?? id
}

export const languageIds = Object.keys(translations) as LanguageId[]
