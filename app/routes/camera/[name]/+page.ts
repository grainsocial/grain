import { browser } from "$app/environment";
import { FEED_PAGE_SIZE, cameraFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const camera = decodeURIComponent(params.name);
  const { queryClient } = await parent();
  const prefetch = queryClient.prefetchQuery(cameraFeedQuery(camera, FEED_PAGE_SIZE, fetch));
  if (!browser) await prefetch;
  return { camera };
};
