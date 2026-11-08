export type SortOrder = 'new' | 'hot' | 'top' | 'rising'

export interface ListingRequest {
  label: string
  url: string
}

/**
 * Reddit's edge blocks the literal `/r/<sub>/new.json` path for logged-in
 * browsers (403 "blocked by network security"), while the sorted listing
 * endpoint still answers with JSON. Keep a short fallback chain so a future
 * change on Reddit's side can be absorbed without shipping a new build.
 */
export function buildListingRequests(
  subreddit: string,
  after: string | null,
  limit = 100,
  sort: SortOrder = 'new'
): ListingRequest[] {
  const name = encodeURIComponent(subreddit)
  const params = new URLSearchParams({
    sort,
    limit: String(Math.max(1, Math.min(100, Math.round(limit)))),
    raw_json: '1',
    include_over_18: 'on'
  })
  if (after) params.set('after', after)
  const query = params.toString()

  return [
    { label: `sorted listing (${sort})`, url: `/r/${name}.json?${query}` },
    { label: `api listing (${sort})`, url: `https://api.reddit.com/r/${name}/${sort === 'rising' ? 'new' : sort}?${query}` },
    { label: 'legacy', url: `/r/${name}/${sort === 'rising' ? 'new' : sort}.json?${query}` }
  ]
}
