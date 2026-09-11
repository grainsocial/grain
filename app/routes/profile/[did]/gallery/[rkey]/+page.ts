import { browser } from "$app/environment";
import { galleryQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch, url }) => {
  const did = decodeURIComponent(params.did);
  const rkey = params.rkey;
  const galleryUri = `at://${did}/social.grain.gallery/${rkey}`;
  const { queryClient } = await parent();
  // `?group=` means the gallery lives in that community's pool rather than the
  // public repo: there is nothing in the index to warm, and the read it needs
  // is the viewer's own credentialed one, made in the browser.
  if (url.searchParams.has("group")) return { did, rkey, galleryUri, wide: true };
  const prefetch = queryClient.prefetchQuery(galleryQuery(galleryUri, fetch));
  if (!browser) await prefetch;
  return { did, rkey, galleryUri, wide: true };
};
