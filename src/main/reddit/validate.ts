import type { SubredditInfo, UserInfo } from '@shared/types'
import { RedditError } from './errors'
import type { RedditClient } from './client'

export function normalizeSubredditName(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?reddit\.com\//i, '')
    .replace(/^\/?r\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^u\//i, '')
    .trim()
}

export function isValidSubredditName(name: string): boolean {
  return /^[A-Za-z0-9_]{2,21}$/.test(name)
}

export async function validateSubreddit(
  client: RedditClient,
  input: string,
  signal?: AbortSignal
): Promise<SubredditInfo> {
  const name = normalizeSubredditName(input)
  if (!isValidSubredditName(name)) {
    throw new RedditError(
      'NOT_FOUND',
      'Enter a valid subreddit name (2–21 letters, numbers or underscores).'
    )
  }

  const json = await client.getJson<any>(
    `/r/${encodeURIComponent(name)}/about.json?raw_json=1`,
    signal
  )
  const data = json?.data
  if (!data) {
    throw new RedditError('NOT_FOUND', `r/${name} could not be found.`)
  }

  return {
    name: data.display_name ?? name,
    title: data.title ?? '',
    description: data.public_description ?? data.description ?? '',
    subscribers:
      typeof data.subscribers === 'number' && data.subscribers >= 0 ? data.subscribers : null,
    over18: Boolean(data.over18),
    quarantined: Boolean(data.quarantine),
    subredditType: data.subreddit_type ?? 'unknown',
    iconUrl: data.community_icon?.split('?')?.[0] || data.icon_img?.split('?')?.[0] || null,
    bannerUrl:
      data.banner_background_image?.split('?')?.[0] || data.banner_img?.split('?')?.[0] || null,
    validatedAt: Date.now()
  }
}

export async function validateUser(
  client: RedditClient,
  input: string,
  signal?: AbortSignal
): Promise<UserInfo> {
  const name = normalizeSubredditName(input)
  if (!isValidSubredditName(name)) {
    throw new RedditError(
      'NOT_FOUND',
      'Enter a valid username (2–21 letters, numbers or underscores).'
    )
  }

  const json = await client.getJson<any>(
    `/user/${encodeURIComponent(name)}/about.json?raw_json=1`,
    signal
  )
  const data = json?.data
  if (!data) {
    throw new RedditError('NOT_FOUND', `u/${name} could not be found.`)
  }

  return {
    name: data.name ?? name,
    linkKarma:
      typeof data.link_karma === 'number' && data.link_karma >= 0 ? data.link_karma : null,
    commentKarma:
      typeof data.comment_karma === 'number' && data.comment_karma >= 0 ? data.comment_karma : null,
    iconUrl: data.icon_img?.split('?')?.[0] ?? null,
    createdUtc: typeof data.created_utc === 'number' ? data.created_utc : null,
    isGold: Boolean(data.is_gold),
    isMod: Boolean(data.is_mod),
    validatedAt: Date.now()
  }
}
