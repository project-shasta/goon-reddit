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

export type TranslationValue =
  | string
  | ((n: number) => string)
  | ((u: string) => string)
  | ((done: number, total: number) => string)

export type Translation = Record<string, TranslationValue>
