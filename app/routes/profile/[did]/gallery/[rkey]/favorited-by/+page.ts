import { browser } from "$app/environment";
import { galleryFavoritesQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const did = decodeURIComponent(params.did);
  const rkey = params.rkey;
  const galleryUri = `at://${did}/social.grain.gallery/${rkey}`;
  const { queryClient, viewer } = await parent();
  const prefetch = queryClient.prefetchQuery(galleryFavoritesQuery(galleryUri, viewer?.did, fetch));
  if (!browser) await prefetch;
  return { did, rkey, galleryUri };
};
