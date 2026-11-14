export type LanguageId =
  | 'en'
  | 'de'
  | 'uk'
  | 'zh-TW'
  | 'zh'
  | 'ja'
  | 'fr'
  | 'it'
  | 'es'
  | 'pirate'
  | 'cyberpunk'
  | 'eo'
  | 'enSimple'
  | 'matrix'

export type TranslationValue =
  | string
  | ((n: number) => string)
  | ((u: string) => string)
  | ((done: number, total: number) => string)
  | ((done: number, skipped: number, failed: number) => string)
  | ((tools: string[]) => string)

export type Translation = Record<string, TranslationValue>
