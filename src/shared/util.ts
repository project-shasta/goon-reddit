/** Clamp a value to an integer range, returning fallback if not finite. */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Coerce a value to boolean, returning fallback if not strictly a boolean. */
export function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Valid language IDs for settings validation. */
export const VALID_LANGUAGES = [
  'en', 'de', 'uk', 'zh-TW', 'zh', 'ja', 'fr', 'it', 'es',
  'pirate', 'cyberpunk', 'eo', 'enSimple', 'matrix'
] as const

/** Valid sort orders for settings validation. */
export const VALID_SORT_ORDERS = ['new', 'hot', 'top', 'rising'] as const

/** Valid theme IDs for settings validation. */
export const VALID_THEMES = ['dark', 'midnight', 'circuit', 'corporate', 'vaporwave', 'matrix'] as const
