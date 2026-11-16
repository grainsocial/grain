import { browser } from "$app/environment";
import { hashtagFeedInfiniteQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const tag = decodeURIComponent(params.tag);
  const { queryClient } = await parent();
  const prefetch = queryClient.prefetchInfiniteQuery(hashtagFeedInfiniteQuery(tag, fetch));
  if (!browser) await prefetch;
  return { tag, wide: true };
};
