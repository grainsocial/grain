import { callXrpc } from "$hatk/client";

export async function queryFeed(feed: string, params?: Record<string, string>) {
  return callXrpc("dev.hatk.getFeed", { feed, ...params });
}
