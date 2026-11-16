import { browser } from "$app/environment";
import { galleryQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const actor = decodeURIComponent(params.actor);
  const rkey = params.rkey;
  const galleryUri = `at://${actor}/social.grain.gallery/${rkey}`;
  const { queryClient } = await parent();
  const prefetch = queryClient.prefetchQuery(galleryQuery(galleryUri, fetch));
  if (!browser) await prefetch;
  return { actor, rkey, galleryUri };
};
