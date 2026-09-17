import { error } from "@sveltejs/kit";
import type { QueryClient } from "@tanstack/svelte-query";
import type { GrainActorDefsProfileViewDetailed } from "$hatk/client";
import { actorProfileQuery } from "./queries";

type Fetch = typeof globalThis.fetch;

/** What a handle resolves to, so a revisit costs nothing. */
const handleDidKey = (handle: string) => ["handleDid", handle] as const;

/**
 * Resolve the `:actor` route segment, a handle or a DID, to a DID.
 *
 * Profile routes key every query, and every mutation's cache invalidation, by
 * DID: a follow bumps `["actorProfile", did]`, the follow record's subject is
 * a DID, and "is this my own profile" compares DIDs. So a handle in the URL
 * has to become a DID before the page renders, not after. The profile fetch is
 * the resolver, since the page needs it anyway and the server already accepts
 * a handle there; the answer is seeded under the DID key so the page's own
 * query starts warm instead of fetching the same profile a second time.
 *
 * Only one copy of a profile may survive that fetch. The read is keyed by the
 * handle, and nothing else in the app touches that key — a follow invalidates
 * `["actorProfile", did]` — so a handle-keyed copy left behind would sit there
 * going quietly out of date and overwrite the live profile the next time the
 * route was visited. The handle's DID is remembered instead, which is the only
 * part of that answer this is asking for, and a revisit resolves from it
 * without a request.
 *
 * A DID passes straight through without a request.
 */
export async function resolveRouteActor(
  queryClient: QueryClient,
  actor: string,
  viewer?: string,
  f?: Fetch,
): Promise<string> {
  if (actor.startsWith("did:")) return actor;

  const known = queryClient.getQueryData<string>(handleDidKey(actor));
  if (known) return known;

  let profile: GrainActorDefsProfileViewDetailed;
  try {
    // No retries: an unknown handle is a 400 from the server, and backing off
    // three times before saying "not found" is seven seconds of spinner.
    profile = await queryClient.fetchQuery({
      ...actorProfileQuery(actor, viewer, f),
      retry: false,
    });
  } catch (err) {
    if (err instanceof Error && /failed: 4\d\d$/.test(err.message)) {
      error(404, "Profile not found");
    }
    throw err;
  }
  queryClient.removeQueries({ queryKey: actorProfileQuery(actor).queryKey, exact: true });
  queryClient.setQueryData(handleDidKey(actor), profile.did);
  queryClient.setQueryData(actorProfileQuery(profile.did, viewer).queryKey, profile);
  return profile.did;
}
