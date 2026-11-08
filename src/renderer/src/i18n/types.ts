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

export type Translation = Record<string, string | ((n: number) => string) | ((u: string) => string)>
