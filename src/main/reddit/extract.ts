import type { MediaItem } from '@shared/types'
import {
  buildFilename,
  extensionFromMime,
  extensionFromUrl
} from '@shared/filename'

export interface ExtractOptions {
  includeImages: boolean
  includeGalleries: boolean
  includeVideos: boolean
  includeExternalVideos: boolean
  skipNsfw: boolean
}

type RedditPost = Record<string, any>

const VIDEO_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'youtu.be',
  'vimeo.com',
  'redgifs.com',
  'www.redgifs.com',
  'v3.redgifs.com',
  'streamable.com',
  'twitch.tv',
  'www.twitch.tv',
  'clips.twitch.tv',
  'tiktok.com',
  'www.tiktok.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'www.instagram.com',
  'imgur.com',
  'www.imgur.com',
  'gfycat.com',
  'www.gfycat.com'
])

function decodeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const decoded = value.replace(/&amp;/g, '&')
  return decoded.startsWith('//') ? `https:${decoded}` : decoded
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function isDirectImageUrl(url: string): boolean {
  const ext = extensionFromUrl(url)
  return ext !== null && ['jpg', 'png', 'gif', 'webp', 'avif'].includes(ext)
}

function isDirectVideoUrl(url: string): boolean {
  const ext = extensionFromUrl(url)
  return ext !== null && ['mp4', 'webm', 'mov', 'mkv', 'm4v'].includes(ext)
}

/**
 * Detect Reddit's "image deleted" placeholder images.  These are served from
 * external-preview / external-content hosts and have the same URL pattern as
 * real images, but contain text instead of the original content.
 */
function isDeletedImagePlaceholder(url: string): boolean {
  const h = hostOf(url)
  if (h === 'external-preview.redd.it' || h === 'external-content.redd.it') {
    const ext = extensionFromUrl(url)
    return ext !== null && ['jpg', 'png', 'gif', 'webp', 'avif'].includes(ext)
  }
  return false
}

function isVideoHost(url: string): boolean {
  const host = hostOf(url).replace(/^www\./, '')
  if (VIDEO_HOSTS.has(host)) return true
  if (/\.gifv(?:[?#]|$)/i.test(url)) return true
  return isDirectVideoUrl(url)
}

/**
 * Strip query / fragment from i.redd.it URLs.  Reddit appends
 * ?width=…&format=…&s=… which forces a small thumbnail — removing them
 * returns the full-resolution image.
 */
function stripRedditImageParams(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.endsWith('i.redd.it') || parsed.hostname.endsWith('reddit.com')) {
      return parsed.origin + parsed.pathname
    }
  } catch {
    // ignore
  }
  return url
}

function previewFromPost(post: RedditPost): MediaItem['previewUrl'] {
  const images = post.preview?.images
  if (Array.isArray(images) && images[0]) {
    const resolutions = images[0].resolutions
    // Use the highest-resolution variant (last in the array) or the source.
    const best =
      Array.isArray(resolutions) && resolutions.length > 0
        ? resolutions[resolutions.length - 1]
        : images[0].source
    const url = decodeUrl(best?.url)
    if (url) return url
  }
  if (typeof post.thumbnail === 'string' && /^https?:\/\//.test(post.thumbnail)) {
    return post.thumbnail
  }
  return null
}

function galleryPreview(meta: RedditPost): string | null {
  const previews = meta?.p
  if (Array.isArray(previews) && previews.length > 0) {
    return decodeUrl(previews[0]?.u)
  }
  return decodeUrl(meta?.s?.u)
}

function baseItem(post: RedditPost, options: ExtractOptions): Omit<MediaItem, 'kind' | 'sourceUrl' | 'ext' | 'filename' | 'mediaId'> | null {
  const postId = post.id ? String(post.id) : null
  if (!postId) return null

  const over18 = Boolean(post.over_18)
  if (options.skipNsfw && over18) return null

  return {
    id: postId,
    postId,
    postTitle: typeof post.title === 'string' ? post.title : '',
    author: typeof post.author === 'string' ? post.author : 'unknown',
    permalink: post.permalink ? `https://www.reddit.com${post.permalink}` : `https://www.reddit.com`,
    score: typeof post.score === 'number' ? post.score : 0,
    over18,
    createdUtc: typeof post.created_utc === 'number' ? post.created_utc : 0,
    previewUrl: previewFromPost(post),
    width: post.preview?.images?.[0]?.source?.width ?? null,
    height: post.preview?.images?.[0]?.source?.height ?? null,
    duration: null,
    localPath: null
  }
}

function extractFromPost(post: RedditPost, options: ExtractOptions, depth = 0): MediaItem[] {
  if (!post || typeof post !== 'object') return []
  if (post.removed_by_category || post.removed) return []

  // Crossposts: download the original post's media, deduped by the original id.
  if (depth < 2 && Array.isArray(post.crosspost_parent_list) && post.crosspost_parent_list[0]) {
    return extractFromPost(post.crosspost_parent_list[0], options, depth + 1)
  }

  const base = baseItem(post, options)
  if (!base) return []

  if (post.is_gallery && options.includeGalleries) {
    const galleryItems = post.gallery_data?.items
    const metadata = post.media_metadata
    if (Array.isArray(galleryItems) && metadata && galleryItems.length > 0) {
      const items: MediaItem[] = []
      galleryItems.forEach((galleryItem: any, index: number) => {
        const mediaId = galleryItem?.media_id
        const meta = mediaId ? metadata[mediaId] : null
        if (!mediaId || !meta) return

        const animated = meta.e === 'AnimatedImage'
        const ext = animated
          ? 'gif'
          : extensionFromMime(meta.m) ?? extensionFromUrl(decodeUrl(meta.s?.u) ?? '') ?? 'jpg'
        const sourceUrl = animated
          ? decodeUrl(meta.s?.gif) ?? `https://i.redd.it/${mediaId}.gif`
          : `https://i.redd.it/${mediaId}.${ext}`

        items.push({
          ...base,
          id: `${base.postId}:${index}`,
          mediaId: String(mediaId),
          kind: 'gallery',
          sourceUrl,
          previewUrl: galleryPreview(meta) ?? base.previewUrl,
          ext,
          filename: buildFilename({
            postId: base.postId,
            title: base.postTitle,
            createdUtc: base.createdUtc,
            ext,
            index,
            total: galleryItems.length
          }),
          width: meta.s?.x ?? null,
          height: meta.s?.y ?? null,
          localPath: null
        })
      })
      if (items.length > 0) return items
    }
  }

  const rv =
    post.secure_media?.reddit_video ??
    post.media?.reddit_video ??
    post.preview?.reddit_video_preview ??
    null

  if ((post.is_video || rv) && options.includeVideos) {
    const dashUrl = decodeUrl(rv?.dash_url)
    const hlsUrl = decodeUrl(rv?.hls_url)
    const fallbackUrl = decodeUrl(rv?.fallback_url)

    let sourceUrl: string | null = null
    let strategy: MediaItem['videoStrategy'] = 'fallback'

    if (dashUrl) {
      sourceUrl = dashUrl
      strategy = 'dash'
    } else if (hlsUrl) {
      sourceUrl = hlsUrl
      strategy = 'hls'
    } else if (fallbackUrl) {
      sourceUrl = fallbackUrl
      strategy = 'fallback'
    } else {
      const rawUrl = post.url_overridden_by_dest || post.url
      const match = typeof rawUrl === 'string' ? /v\.redd\.it\/([a-z0-9]+)/i.exec(rawUrl) : null
      if (match) {
        sourceUrl = `https://v.redd.it/${match[1]}/HLSPlaylist.m3u8`
        strategy = 'hls'
      }
    }

    if (sourceUrl) {
      return [
        {
          ...base,
          id: `${base.postId}:video`,
          mediaId: null,
          kind: 'video',
          sourceUrl,
          ext: 'mp4',
          filename: buildFilename({
            postId: base.postId,
            title: base.postTitle,
            createdUtc: base.createdUtc,
            ext: 'mp4'
          }),
          duration: typeof rv?.duration === 'number' ? rv.duration : null,
          width: rv?.width ?? base.width,
          height: rv?.height ?? base.height,
          videoStrategy: strategy,
          videoAlternates: {
            ...(dashUrl ? { dash: dashUrl } : {}),
            ...(hlsUrl ? { hls: hlsUrl } : {}),
            ...(fallbackUrl ? { fallback: fallbackUrl } : {})
          },
          localPath: null
        }
      ]
    }
  }

  const rawUrl: string | null = post.url_overridden_by_dest || post.url || null
  const sourceUrl = decodeUrl(rawUrl)

  if (sourceUrl && !post.is_self) {
    const hint = post.post_hint

    if (isDeletedImagePlaceholder(sourceUrl)) {
      // Skip "image deleted" placeholders — they're just text images.
      return []
    }

    if (hint === 'image' || (hostOf(sourceUrl) === 'i.redd.it' && isDirectImageUrl(sourceUrl))) {
      if (options.includeImages) {
        const ext = extensionFromUrl(sourceUrl) ?? 'jpg'
        const fullRes = stripRedditImageParams(sourceUrl)
        return [
          {
            ...base,
            id: `${base.postId}:image`,
            mediaId: null,
            kind: 'image',
            sourceUrl: fullRes,
            ext,
            filename: buildFilename({
              postId: base.postId,
              title: base.postTitle,
              createdUtc: base.createdUtc,
              ext
            }),
            localPath: null
          }
        ]
      }
      return []
    }

    if (hint === 'rich:video' || isVideoHost(sourceUrl)) {
      if (options.includeExternalVideos) {
        return [
          {
            ...base,
            id: `${base.postId}:external-video`,
            mediaId: null,
            kind: 'external-video',
            sourceUrl,
            ext: 'mp4',
            filename: buildFilename({
              postId: base.postId,
              title: base.postTitle,
              createdUtc: base.createdUtc,
              ext: 'mp4'
            }),
            videoStrategy: 'ytdlp',
            localPath: null
          }
        ]
      }
      return []
    }

    if (options.includeImages && isDirectImageUrl(sourceUrl) && post.is_self !== true) {
      const ext = extensionFromUrl(sourceUrl) ?? 'jpg'
      return [
        {
          ...base,
          id: `${base.postId}:external-image`,
          mediaId: null,
          kind: 'external-image',
          sourceUrl,
          ext,
          filename: buildFilename({
            postId: base.postId,
            title: base.postTitle,
            createdUtc: base.createdUtc,
            ext
          }),
          localPath: null
        }
      ]
    }
  }

  return []
}

export function extractMedia(post: RedditPost, options: ExtractOptions): MediaItem[] {
  return extractFromPost(post, options)
}
