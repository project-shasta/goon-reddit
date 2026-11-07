import { describe, expect, it } from 'vitest'
import { extractMedia, type ExtractOptions } from '../src/main/reddit/extract'
import type { MediaItem } from '../src/shared/types'

const ALL: ExtractOptions = {
  includeImages: true,
  includeGalleries: true,
  includeVideos: true,
  includeExternalVideos: true,
  skipNsfw: false
}

function post(overrides: Record<string, unknown> = {}): Record<string, any> {
  return {
    id: 'abc123',
    title: 'A nice test post!',
    author: 'tester',
    permalink: '/r/pics/comments/abc123/a_nice_test_post/',
    score: 42,
    over_18: false,
    created_utc: 1751000000,
    url: 'https://i.redd.it/xyz.jpg',
    post_hint: 'image',
    ...overrides
  }
}

function ids(items: MediaItem[]): string[] {
  return items.map((item) => item.id)
}

describe('extractMedia', () => {
  it('extracts a single direct image', () => {
    const items = extractMedia(post(), ALL)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'abc123:image',
      postId: 'abc123',
      kind: 'image',
      sourceUrl: 'https://i.redd.it/xyz.jpg',
      ext: 'jpg',
      author: 'tester',
      score: 42,
      over18: false,
      localPath: null
    })
    expect(items[0].filename).toMatch(/^\d{4}-\d{2}-\d{2}_abc123_a-nice-test-post\.jpg$/)
  })

  it('extracts i.redd.it images even when post_hint is missing', () => {
    const items = extractMedia(post({ post_hint: undefined }), ALL)
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('image')
  })

  it('extracts gallery images with ordered filenames', () => {
    const items = extractMedia(
      post({
        is_gallery: true,
        url: 'https://www.reddit.com/gallery/abc123',
        gallery_data: {
          items: [{ media_id: 'm1' }, { media_id: 'm2' }, { media_id: 'm3' }]
        },
        media_metadata: {
          m1: { m: 'image/jpeg', s: { u: 'https://preview.redd.it/m1.jpg?width=1080', x: 1080, y: 720 } },
          m2: { m: 'image/png', s: { u: 'https://preview.redd.it/m2.png?width=800', x: 800, y: 600 } },
          m3: { m: 'image/webp', s: { u: 'https://preview.redd.it/m3.webp?width=640', x: 640, y: 480 } }
        }
      }),
      ALL
    )

    expect(ids(items)).toEqual(['abc123:0', 'abc123:1', 'abc123:2'])
    expect(items.map((item) => item.ext)).toEqual(['jpg', 'png', 'webp'])
    expect(items.map((item) => item.sourceUrl)).toEqual([
      'https://i.redd.it/m1.jpg',
      'https://i.redd.it/m2.png',
      'https://i.redd.it/m3.webp'
    ])
    expect(items[0].filename).toMatch(/_01\.jpg$/)
    expect(items[1].filename).toMatch(/_02\.png$/)
    expect(items[2].filename).toMatch(/_03\.webp$/)
    expect(items[1].width).toBe(800)
    expect(items[1].height).toBe(600)
  })

  it('uses the animated gif for animated gallery entries', () => {
    const items = extractMedia(
      post({
        is_gallery: true,
        gallery_data: { items: [{ media_id: 'anim' }] },
        media_metadata: {
          anim: {
            e: 'AnimatedImage',
            m: 'image/gif',
            s: { gif: 'https://i.redd.it/anim.gif', u: 'https://preview.redd.it/anim.png' }
          }
        }
      }),
      ALL
    )

    expect(items).toHaveLength(1)
    expect(items[0].ext).toBe('gif')
    expect(items[0].sourceUrl).toBe('https://i.redd.it/anim.gif')
  })

  it('falls back to a constructed gif url when the animated source is missing', () => {
    const items = extractMedia(
      post({
        is_gallery: true,
        gallery_data: { items: [{ media_id: 'anim2' }] },
        media_metadata: { anim2: { e: 'AnimatedImage', m: 'image/gif', s: {} } }
      }),
      ALL
    )
    expect(items[0].sourceUrl).toBe('https://i.redd.it/anim2.gif')
  })

  it('extracts the original media of a crosspost', () => {
    const original = post({
      id: 'orig999',
      title: 'Original title',
      url: 'https://i.redd.it/orig.png',
      post_hint: 'image'
    })
    const items = extractMedia(
      post({ id: 'cross1', title: 'Crosspost title', crosspost_parent_list: [original] }),
      ALL
    )

    expect(items).toHaveLength(1)
    expect(items[0].postId).toBe('orig999')
    expect(items[0].postTitle).toBe('Original title')
    expect(items[0].sourceUrl).toBe('https://i.redd.it/orig.png')
  })

  it('does not recurse forever on nested crossposts', () => {
    const deeply = post({ id: 'deep', crosspost_parent_list: [post({ id: 'deeper' })] })
    const items = extractMedia(post({ id: 'top', crosspost_parent_list: [deeply] }), ALL)
    // The nested original resolves to a normal image post.
    expect(items).toHaveLength(1)
    expect(items[0].postId).toBe('deeper')
  })

  it('extracts a Reddit-hosted video via DASH with alternates', () => {
    const items = extractMedia(
      post({
        is_video: true,
        post_hint: 'hosted:video',
        url: 'https://v.redd.it/xyzvideo',
        media: {
          reddit_video: {
            dash_url: 'https://v.redd.it/xyzvideo/DASHPlaylist.mpd?a=1&amp;b=2',
            hls_url: 'https://v.redd.it/xyzvideo/HLSPlaylist.m3u8',
            fallback_url: 'https://v.redd.it/xyzvideo/DASH_720.mp4',
            duration: 12,
            width: 1280,
            height: 720
          }
        }
      }),
      ALL
    )

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'abc123:video',
      kind: 'video',
      ext: 'mp4',
      duration: 12,
      width: 1280,
      height: 720,
      videoStrategy: 'dash'
    })
    expect(items[0].sourceUrl).toBe('https://v.redd.it/xyzvideo/DASHPlaylist.mpd?a=1&b=2')
    expect(items[0].videoAlternates).toEqual({
      dash: 'https://v.redd.it/xyzvideo/DASHPlaylist.mpd?a=1&b=2',
      hls: 'https://v.redd.it/xyzvideo/HLSPlaylist.m3u8',
      fallback: 'https://v.redd.it/xyzvideo/DASH_720.mp4'
    })
  })

  it('uses the video preview when secure media is missing', () => {
    const items = extractMedia(
      post({
        is_video: true,
        post_hint: 'hosted:video',
        preview: {
          reddit_video_preview: {
            hls_url: 'https://v.redd.it/preview/HLSPlaylist.m3u8'
          }
        }
      }),
      ALL
    )
    expect(items[0].videoStrategy).toBe('hls')
    expect(items[0].sourceUrl).toBe('https://v.redd.it/preview/HLSPlaylist.m3u8')
  })

  it('extracts external videos', () => {
    const items = extractMedia(
      post({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        post_hint: 'rich:video'
      }),
      ALL
    )

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'abc123:external-video',
      kind: 'external-video',
      videoStrategy: 'ytdlp',
      ext: 'mp4'
    })
  })

  it('treats direct mp4 links as external videos', () => {
    const items = extractMedia(
      post({ url: 'https://cdn.example.com/clip.mp4', post_hint: undefined }),
      ALL
    )
    expect(items[0].kind).toBe('external-video')
  })

  it('treats imgur .gifv links as external videos', () => {
    const items = extractMedia(
      post({ url: 'https://i.imgur.com/abc123.gifv', post_hint: undefined }),
      ALL
    )
    expect(items[0].kind).toBe('external-video')
  })

  it('extracts external direct images', () => {
    const items = extractMedia(
      post({ url: 'https://images.example.com/photo.webp', post_hint: undefined }),
      ALL
    )
    expect(items[0]).toMatchObject({
      id: 'abc123:external-image',
      kind: 'external-image',
      ext: 'webp'
    })
  })

  it('skips self and plain link posts', () => {
    expect(extractMedia(post({ is_self: true, url: 'https://reddit.com/r/pics/abc' }), ALL)).toEqual(
      []
    )
    expect(
      extractMedia(post({ url: 'https://example.com/news', post_hint: 'link' }), ALL)
    ).toEqual([])
  })

  it('skips removed posts', () => {
    expect(extractMedia(post({ removed: true }), ALL)).toEqual([])
    expect(extractMedia(post({ removed_by_category: 'moderator' }), ALL)).toEqual([])
  })

  it('respects media type flags', () => {
    const noImages = { ...ALL, includeImages: false }
    expect(extractMedia(post(), noImages)).toEqual([])

    const noGalleries = { ...ALL, includeGalleries: false }
    expect(
      extractMedia(
        post({
          is_gallery: true,
          url: 'https://www.reddit.com/gallery/abc123',
          post_hint: undefined,
          gallery_data: { items: [{ media_id: 'm1' }] },
          media_metadata: { m1: { m: 'image/jpeg', s: {} } }
        }),
        noGalleries
      )
    ).toEqual([])

    const noVideos = { ...ALL, includeVideos: false }
    expect(
      extractMedia(
        post({
          is_video: true,
          url: 'https://v.redd.it/xyzvideo',
          post_hint: 'hosted:video',
          media: { reddit_video: { dash_url: 'https://v.redd.it/x/DASH.mpd' } }
        }),
        noVideos
      )
    ).toEqual([])

    const noExternal = { ...ALL, includeExternalVideos: false }
    expect(
      extractMedia(post({ url: 'https://youtu.be/abc', post_hint: 'rich:video' }), noExternal)
    ).toEqual([])
  })

  it('skips NSFW posts when requested', () => {
    expect(extractMedia(post({ over_18: true }), { ...ALL, skipNsfw: true })).toEqual([])
    expect(extractMedia(post({ over_18: true }), ALL)).toHaveLength(1)
  })

  it('returns nothing for malformed posts', () => {
    expect(extractMedia(null as never, ALL)).toEqual([])
    expect(extractMedia({ title: 'no id' }, ALL)).toEqual([])
  })
})
