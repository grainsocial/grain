import { browser } from "$app/environment";
import { storyQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, parent, fetch }) => {
  const did = decodeURIComponent(params.did);
  const rkey = params.rkey;
  const storyUri = `at://${did}/social.grain.story/${rkey}`;
  const { queryClient } = await parent();
  const prefetch = queryClient.prefetchQuery(storyQuery(storyUri, fetch));
  if (!browser) await prefetch;
  return { did, rkey, storyUri };
};
