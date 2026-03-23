import { browser } from "$app/environment";
import { knownFollowersQuery, actorProfileQuery } from "$lib/queries";

export async function load({ params, parent, fetch }: any) {
  const did = decodeURIComponent(params.did);
  const { queryClient, viewer } = await parent();
  if (viewer) {
    const prefetch = Promise.all([
      queryClient.prefetchQuery(knownFollowersQuery(did, viewer.did, fetch)),
      queryClient.prefetchQuery(actorProfileQuery(did, viewer.did, fetch)),
    ]);
    if (!browser) await prefetch;
  }
  return { did };
}
