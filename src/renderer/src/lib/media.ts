import type { MediaItem } from '@shared/types'

export function isViewableImage(item: MediaItem): boolean {
  return item.kind === 'image' || item.kind === 'gallery' || item.kind === 'external-image'
}

export function localMediaUrl(localPath: string): string {
  return `rdm-media://local/?path=${encodeURIComponent(localPath)}`
}

/** Full-size image source for the slideshow. */
export function mediaSrc(item: MediaItem): string {
  if (item.localPath) return localMediaUrl(item.localPath)
  if (isViewableImage(item)) return item.sourceUrl
  return item.previewUrl ?? item.sourceUrl
}

/** Small preview used for the grid; falls back to the full image. */
export function thumbSrc(item: MediaItem): string {
  return item.previewUrl ?? item.sourceUrl
}

/** Used when the primary source fails to load. */
export function mediaFallbackSrc(item: MediaItem): string | null {
  if (item.localPath && item.previewUrl) return item.previewUrl
  if (item.previewUrl && item.previewUrl !== item.sourceUrl) return item.previewUrl
  if (item.sourceUrl && item.sourceUrl !== item.previewUrl) return item.sourceUrl
  return null
}

/**
 * Reddit serves "image deleted" placeholder images from these hosts.
 * When a primary image 404s and the only fallback is one of these,
 * the result will be placeholder text, not the actual image.
 */
export function isRedditPreviewHost(url: string): boolean {
  try {
    const h = new URL(url).hostname
    return (
      h === 'preview.redd.it' ||
      h === 'external-preview.redd.it' ||
      h === 'external-content.redd.it'
    )
  } catch {
    return false
  }
}
