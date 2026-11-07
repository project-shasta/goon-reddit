import { describe, expect, it } from 'vitest'
import { buildListingRequests } from '../src/main/reddit/listing'

describe('buildListingRequests', () => {
  it('puts the sorted listing endpoint first', () => {
    const [first] = buildListingRequests('pics', null)
    expect(first.url).toBe(
      '/r/pics.json?sort=new&limit=100&raw_json=1&include_over_18=on'
    )
  })

  it('keeps the literal new.json path only as a last resort', () => {
    const urls = buildListingRequests('pics', null).map((request) => request.url)
    expect(urls.some((url) => url.startsWith('https://api.reddit.com/r/pics/new?'))).toBe(true)
    expect(urls.at(-1)).toContain('/r/pics/new.json?')
    expect(urls[0]).not.toContain('/new.json')
  })

  it('forwards the pagination cursor', () => {
    const [first] = buildListingRequests('pics', 't3_abc123')
    const params = new URL(first.url, 'https://www.reddit.com').searchParams
    expect(params.get('after')).toBe('t3_abc123')
    expect(params.get('sort')).toBe('new')
  })

  it('encodes subreddit names and clamps the page size', () => {
    const [low] = buildListingRequests('news+worldnews', null, 0)
    const [high] = buildListingRequests('news+worldnews', null, 500)
    expect(low.url.startsWith('/r/news%2Bworldnews.json?')).toBe(true)
    expect(new URL(low.url, 'https://www.reddit.com').searchParams.get('limit')).toBe('1')
    expect(new URL(high.url, 'https://www.reddit.com').searchParams.get('limit')).toBe('100')
  })
})
