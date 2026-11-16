import { browser } from "$app/environment";
import { resolveRouteActor } from "$lib/actor";
import { actorProfileQuery, actorFeedQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const { queryClient, viewer } = await parent();
  const did = await resolveRouteActor(
    queryClient,
    decodeURIComponent(params.actor),
    viewer?.did,
    fetch,
  );
  const prefetch = Promise.all([
    queryClient.prefetchQuery(actorProfileQuery(did, viewer?.did, fetch)),
    queryClient.prefetchInfiniteQuery(actorFeedQuery(did, fetch)),
  ]);
  if (!browser) await prefetch;
  return { did, wide: true, full: !viewer };
};
