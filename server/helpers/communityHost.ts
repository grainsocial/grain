// Where a community is run. A community's DID document names its PDS, and on
// the opensocial design the host *is* that PDS: the fyi.opensocial.*
// methods are served from the same origin, and the host's own identity — the
// audience a service-auth token must name — is its did:web at that origin.
// Nothing here is opensocial-specific beyond that convention: resolve the DID,
// read the PDS, ask the PDS who it is.
const plcUrl = process.env.DID_PLC_URL ?? "https://plc.directory";
const cache = new Map<string, { url: string; did: string }>();

export async function communityHostFor(did: string): Promise<{ url: string; did: string }> {
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
  if (!hostDid) throw new Error(`${url} does not identify itself as a community host`);
  const out = { url: url.replace(/\/$/, ""), did: hostDid };
  cache.set(did, out);
  return out;
}

/**
 * The community's own site, as its host publishes it.
 *
 * Not from the index: a community's profile record is not always indexable
 * here — one carrying an avatar does not survive strict validation — and this
 * is one field on a public, unauthenticated read. Asking the host is also the
 * honest shape of the question. Cached, because a website does not move often
 * and a group page asks on every visit.
 */
const siteCache = new Map<string, { url?: string; at: number }>();
const SITE_TTL_MS = 10 * 60_000;

export async function communitySite(did: string): Promise<string | undefined> {
  const hit = siteCache.get(did);
  if (hit && Date.now() - hit.at < SITE_TTL_MS) return hit.url;
  let url: string | undefined;
  try {
    const host = await communityHostFor(did);
    const res = await fetch(`${host.url}/xrpc/fyi.opensocial.listCommunities`);
    const body = (await res.json()) as { communities?: { did: string; url?: string }[] };
    url = body.communities?.find((c) => c.did === did)?.url;
  } catch {
    // A host that will not answer is not an error worth a page for: the link
    // simply does not appear.
  }
  siteCache.set(did, { url, at: Date.now() });
  return url;
}

/** Call a fyi.opensocial.* procedure on the group's host as the viewer,
 *  with service auth minted by the viewer's own PDS. */
export async function callCommunityHost(
  pds: (
    nsid: string,
    options?: { params?: Record<string, string> },
  ) => Promise<Record<string, unknown>>,
  group: string,
  lxm: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: any }> {
  const host = await communityHostFor(group);
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
