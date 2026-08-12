import { browser } from "$app/environment";
import { FEED_PAGE_SIZE, forYouFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, fetch }) => {
  const { queryClient, viewer } = await parent();
  if (viewer?.did) {
    const prefetch = queryClient.prefetchQuery(forYouFeedQuery(viewer.did, FEED_PAGE_SIZE, fetch));
    if (!browser) await prefetch;
  }
};
