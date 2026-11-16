import { browser } from "$app/environment";
import { cameraFeedInfiniteQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const camera = decodeURIComponent(params.name);
  const { queryClient } = await parent();
  const prefetch = queryClient.prefetchInfiniteQuery(cameraFeedInfiniteQuery(camera, fetch));
  if (!browser) await prefetch;
  return { camera, wide: true };
};
