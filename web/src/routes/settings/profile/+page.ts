import { browser } from "$app/environment";
import { actorProfileQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, fetch }) => {
  const { queryClient, viewer } = await parent();
  if (viewer?.did) {
    const prefetch = queryClient.prefetchQuery(actorProfileQuery(viewer.did, undefined, fetch));
    if (!browser) await prefetch;
  }
};
