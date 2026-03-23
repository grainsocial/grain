import { browser } from "$app/environment";
import { followingQuery, actorProfileQuery } from "$lib/queries";

export async function load({ params, parent, fetch }: any) {
  const did = decodeURIComponent(params.did);
  const { queryClient, viewer } = await parent();
  const prefetch = Promise.all([
    queryClient.prefetchQuery(followingQuery(did, fetch)),
    queryClient.prefetchQuery(actorProfileQuery(did, viewer?.did, fetch)),
  ]);
  if (!browser) await prefetch;
  return { did };
}
