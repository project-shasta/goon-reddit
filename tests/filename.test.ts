import { describe, expect, it } from 'vitest'
import {
  buildFilename,
  extensionFromMime,
  extensionFromUrl,
  formatDate,
  safeFilename,
  slugifyTitle
} from '../src/shared/filename'

describe('slugifyTitle', () => {
  it('produces lowercase hyphenated slugs', () => {
    expect(slugifyTitle('Hello, World!  This is a Test')).toBe('hello-world-this-is-a-test')
  })

  it('strips Windows-invalid characters', () => {
    expect(slugifyTitle('a<b>c:d"e/f\\g|h?i*j')).toBe('a-b-c-d-e-f-g-h-i-j')
  })

  it('keeps unicode letters', () => {
    expect(slugifyTitle('Café déjà vu')).toBe('café-déjà-vu')
  })

  it('falls back for empty titles and trims trailing hyphens', () => {
    expect(slugifyTitle('   ')).toBe('untitled')
    expect(slugifyTitle('!!!')).toBe('untitled')
    expect(slugifyTitle('word '.repeat(40)).length).toBeLessThanOrEqual(60)
    expect(slugifyTitle('word '.repeat(40)).endsWith('-')).toBe(false)
  })
})

describe('safeFilename', () => {
  it('replaces invalid characters', () => {
    expect(safeFilename('a<b>c:d"e/f\\g|h?i*j.png')).toBe('a_b_c_d_e_f_g_h_i_j.png')
  })

  it('preserves spaces but normalizes runs', () => {
    expect(safeFilename('hello    world.txt')).toBe('hello world.txt')
  })

  it('prefixes Windows reserved device names', () => {
    expect(safeFilename('CON')).toBe('_CON')
    expect(safeFilename('lpt1.txt')).toBe('_lpt1.txt')
  })

  it('trims dots and spaces from the end', () => {
    expect(safeFilename('file. . .')).toBe('file')
  })

  it('shortens long names while keeping the extension', () => {
    const result = safeFilename(`${'a'.repeat(200)}.jpg`, 60)
    expect(result.length).toBeLessThanOrEqual(60)
    expect(result.endsWith('.jpg')).toBe(true)
  })

  it('falls back to untitled', () => {
    expect(safeFilename('   ')).toBe('untitled')
  })
})

describe('formatDate', () => {
  it('formats UTC seconds as YYYY-MM-DD', () => {
    expect(formatDate(1751000000)).toBe('2025-06-27')
  })

  it('handles invalid input', () => {
    expect(formatDate(Number.NaN)).toBe('1970-01-01')
  })
})

describe('buildFilename', () => {
  it('builds date_id_slug.ext', () => {
    const name = buildFilename({
      postId: 'abc123',
      title: 'My Great Post!',
      createdUtc: 1751000000,
      ext: '.JPG'
    })
    expect(name).toBe('2025-06-27_abc123_my-great-post.jpg')
  })

  it('adds a zero-padded index for multi-item posts', () => {
    const name = buildFilename({
      postId: 'abc123',
      title: 'Gallery',
      createdUtc: 1751000000,
      ext: 'png',
      index: 0,
      total: 3
    })
    expect(name).toBe('2025-06-27_abc123_gallery_01.png')
  })

  it('does not add an index for a single item', () => {
    const name = buildFilename({
      postId: 'abc123',
      title: 'Gallery',
      createdUtc: 1751000000,
      ext: 'png',
      index: 0,
      total: 1
    })
    expect(name).toBe('2025-06-27_abc123_gallery.png')
  })

  it('sanitizes the final result', () => {
    const name = buildFilename({
      postId: 'id',
      title: 'a/b:c',
      createdUtc: 0,
      ext: 'gif'
    })
    expect(name).toBe('1970-01-01_id_a-b-c.gif')
  })
})

describe('extensionFromUrl', () => {
  it('returns known extensions', () => {
    expect(extensionFromUrl('https://i.redd.it/a.jpg?width=100')).toBe('jpg')
    expect(extensionFromUrl('https://cdn.example.com/a.MP4')).toBe('mp4')
    expect(extensionFromUrl('https://cdn.example.com/a.jpeg')).toBe('jpg')
  })

  it('rejects unknown or missing extensions', () => {
    expect(extensionFromUrl('https://example.com/page')).toBeNull()
    expect(extensionFromUrl('https://example.com/file.exe')).toBeNull()
    expect(extensionFromUrl('not a url')).toBeNull()
  })
})

describe('extensionFromMime', () => {
  it('maps common mime types', () => {
    expect(extensionFromMime('image/jpeg')).toBe('jpg')
    expect(extensionFromMime('image/png; charset=binary')).toBe('png')
    expect(extensionFromMime('image/webp')).toBe('webp')
    expect(extensionFromMime('video/mp4')).toBe('mp4')
  })

  it('returns null for unknown types', () => {
    expect(extensionFromMime('application/octet-stream')).toBeNull()
    expect(extensionFromMime(null)).toBeNull()
  })
})
