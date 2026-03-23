import { browser } from "$app/environment";
import { cameraFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const camera = decodeURIComponent(params.name);
  const { queryClient } = await parent();
  const prefetch = queryClient.prefetchQuery(cameraFeedQuery(camera, 50, fetch));
  if (!browser) await prefetch;
  return { camera };
};
