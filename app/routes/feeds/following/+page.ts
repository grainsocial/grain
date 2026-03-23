import { browser } from "$app/environment";
import { followingFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, fetch }) => {
  const { queryClient, viewer } = await parent();
  if (viewer?.did) {
    const prefetch = queryClient.prefetchQuery(followingFeedQuery(viewer.did, 50, fetch));
    if (!browser) await prefetch;
  }
};
