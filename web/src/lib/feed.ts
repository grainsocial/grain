import type { AtUriString } from "@atproto/lex";
import { query, type Asked, type Fetch } from "$lib/xrpc";
import type * as describeFeeds from "$lib/lexicons/social/grain/feed/describeFeeds.ts";
import type * as getFeedMethod from "$lib/lexicons/social/grain/feed/getFeed.ts";

/**
 * grain's feeds' URIs, by name ("recent", "camera", ...), as
 * `social.grain.feed.describeFeeds` lists them. Asked once, and kept: a
 * feed's URI changes only with the server's DID.
 */
let feeds: Promise<Map<string, AtUriString>> | null = null;

function describe(fetch?: Fetch): Promise<Map<string, AtUriString>> {
  feeds ??= query<typeof describeFeeds.main>("social.grain.feed.describeFeeds", {}, fetch).then(
    (r) => new Map(r.feeds.map((f) => [f.name, f.uri])),
  );
  // One that fails is asked again next time.
  feeds.catch(() => (feeds = null));
  return feeds;
}

/** The URI of the feed named `name`. */
export async function feedUri(name: string, fetch?: Fetch): Promise<AtUriString> {
  const uri = (await describe(fetch)).get(name);
  if (!uri) throw new Error(`no feed named ${name}`);
  return uri;
}

/** Forgets the feeds' URIs, for a test. */
export function forgetFeeds(): void {
  feeds = null;
}

type FeedParams = Omit<Asked<typeof getFeedMethod.main>, "feed">;

/** A page of the feed named `name`, filtered as `params` say. */
export async function getFeed(name: string, params: FeedParams = {}, fetch?: Fetch) {
  const feed = await feedUri(name, fetch);
  return query<typeof getFeedMethod.main>("social.grain.feed.getFeed", { ...params, feed }, fetch);
}

/** A page of the feed named `feed`, with parameters as a page's URL gives them. */
export async function queryFeed(feed: string, params?: Record<string, string>) {
  const { limit, ...rest } = params ?? {};
  return getFeed(feed, { ...rest, ...(limit ? { limit: Number(limit) } : {}) } as FeedParams);
}
