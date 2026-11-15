import type { LanguageId as SharedLanguageId } from '@shared/types'

/** Re-export LanguageId from shared types for use in renderer i18n. */
export type LanguageId = SharedLanguageId

export type TranslationValue =
  | string
  | ((n: number) => string)
  | ((u: string) => string)
  | ((done: number, total: number) => string)
  | ((done: number, skipped: number, failed: number) => string)
  | ((tools: string[]) => string)

export type Translation = Record<string, TranslationValue>
