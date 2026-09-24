// Where a group is run. A group's DID document names its PDS, and on
// the opensocial design the host *is* that PDS: the fyi.opensocial.*
// methods are served from the same origin, and the host's own identity — the
// audience a service-auth token must name — is its did:web at that origin.
// Nothing here is opensocial-specific beyond that convention: resolve the DID,
// read the PDS, ask the PDS who it is.
const plcUrl = process.env.DID_PLC_URL ?? "https://plc.directory";
const cache = new Map<string, { url: string; did: string }>();

export async function groupHostFor(did: string): Promise<{ url: string; did: string }> {
  const hit = cache.get(did);
  if (hit) return hit;
  const doc = await fetch(
    did.startsWith("did:web:")
      ? `https://${did.slice("did:web:".length)}/.well-known/did.json`
      : `${plcUrl}/${did}`,
  ).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`could not resolve ${did}`))));
  const url: string | undefined = doc.service?.find(
    (s: any) => s.id === "#atproto_pds",
  )?.serviceEndpoint;
  if (!url) throw new Error(`${did} has no PDS`);
  const hostDoc = await fetch(`${url}/.well-known/did.json`).then((r) => (r.ok ? r.json() : null));
  const hostDid: string | undefined = hostDoc?.id;
  if (!hostDid) throw new Error(`${url} does not identify itself as a group host`);
  const out = { url: url.replace(/\/$/, ""), did: hostDid };
  cache.set(did, out);
  return out;
}

/** What a group's host lists about it: the public part of its meta space. */
export interface GroupListing {
  displayName?: string;
  description?: string;
  url?: string;
  joinPolicy?: string;
  /** Present when the group has an avatar; see `avatarUrl`. */
  avatar?: string;
  avatarUrl?: string;
  rules?: { rkey: string; title: string; text?: string }[];
}

/**
 * A group's profile and rules, as its host lists them.
 *
 * They live in the group's meta space, and a space cannot be read without
 * signing in as somebody — nor indexed, since nothing in a space reaches a
 * firehose. The host reads the space as the group and lists what its
 * access record makes public, unauthenticated, so this is the one read that
 * works for every viewer. Not part of the standard: a host that does not list
 * its groups yields nothing here, and the group falls back to its grain
 * profile. Cached, because a profile does not move often and a group page asks
 * on every visit.
 */
const listingCache = new Map<string, { listing?: GroupListing; at: number }>();
const LISTING_TTL_MS = 10 * 60_000;

export async function groupListing(did: string): Promise<GroupListing | undefined> {
  const hit = listingCache.get(did);
  if (hit && Date.now() - hit.at < LISTING_TTL_MS) return hit.listing;
  let listing: GroupListing | undefined;
  try {
    const host = await groupHostFor(did);
    const res = await fetch(`${host.url}/xrpc/fyi.opensocial.listGroups`);
    const body = (await res.json()) as { groups?: (GroupListing & { did: string })[] };
    const found = body.groups?.find((c) => c.did === did);
    if (found) {
      const { did: _, ...rest } = found;
      // The host serves a group's images itself, renderably; the CID is
      // only a cache-buster there.
      listing = {
        ...rest,
        ...(rest.avatar
          ? { avatarUrl: `${host.url}/img/${did}/avatar?v=${rest.avatar.slice(-12)}` }
          : {}),
      };
    }
  } catch {
    // A host that will not answer is not an error worth a page for: the group
    // shows what grain itself knows.
  }
  listingCache.set(did, { listing, at: Date.now() });
  return listing;
}

/** Call a fyi.opensocial.* procedure on the group's host as the viewer,
 *  with service auth minted by the viewer's own PDS. */
export async function callGroupHost(
  pds: (
    nsid: string,
    options?: { params?: Record<string, string> },
  ) => Promise<Record<string, unknown>>,
  group: string,
  lxm: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: any }> {
  const host = await groupHostFor(group);
  const { token } = (await pds("com.atproto.server.getServiceAuth", {
    params: { aud: host.did, lxm },
  })) as { token: string };
  const res = await fetch(`${host.url}/xrpc/${lxm}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: json };
}
