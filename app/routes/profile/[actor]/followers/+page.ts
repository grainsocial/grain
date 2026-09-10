import { browser } from "$app/environment";
import { resolveRouteActor } from "$lib/actor";
import { followersQuery, actorProfileQuery } from "$lib/queries";
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
    queryClient.prefetchQuery(followersQuery(did, fetch)),
    queryClient.prefetchQuery(actorProfileQuery(did, viewer?.did, fetch)),
  ]);
  if (!browser) await prefetch;
  return { did };
};
