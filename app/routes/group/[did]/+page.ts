import { browser } from "$app/environment";
import { groupQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const did = decodeURIComponent(params.did);
  const { queryClient, viewer } = await parent();
  // The group itself is public and worth prefetching. Its pool is not: every
  // gallery in it is read through the viewer's own credential at request time,
  // so there is nothing to warm and nothing a signed-out render could show.
  const prefetch = queryClient.prefetchQuery(groupQuery(did, fetch));
  if (!browser) await prefetch;
  // Same shell as a profile: the wide column, and the public top bar when
  // nobody is signed in.
  return { did, wide: true, full: !viewer };
};
