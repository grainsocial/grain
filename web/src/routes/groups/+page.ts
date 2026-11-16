import { browser } from "$app/environment";
import { groupsQuery } from "$lib/queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, fetch }) => {
  const { queryClient, viewer } = await parent();
  const prefetch = queryClient.prefetchQuery(groupsQuery(undefined, fetch));
  if (!browser) await prefetch;
  return { full: !viewer };
};
