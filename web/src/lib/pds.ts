// Reading an account's own repo at its PDS, which answers anyone: for what
// grain-serve's views leave out, such as a record's blob refs.

import { searched, XrpcError } from "$lib/xrpc";

const pdses = new Map<string, Promise<string>>();

/** Where `did`'s DID document says its PDS is. */
export function pdsOf(did: string, fetch: typeof globalThis.fetch = globalThis.fetch) {
  let found = pdses.get(did);
  if (!found) {
    const doc = did.startsWith("did:web:")
      ? `https://${decodeURIComponent(did.slice("did:web:".length))}/.well-known/did.json`
      : `https://plc.directory/${did}`;
    found = fetch(doc)
      .then((res) => {
        if (!res.ok) throw new Error(`${did}: no DID document`);
        return res.json();
      })
      .then((doc) => {
        const services: { id?: string; type?: string; serviceEndpoint?: string }[] =
          doc?.service ?? [];
        const pds = services.find(
          (s) => s.id?.endsWith("#atproto_pds") || s.type === "AtprotoPersonalDataServer",
        );
        if (typeof pds?.serviceEndpoint !== "string") throw new Error(`${did}: no PDS`);
        return pds.serviceEndpoint.replace(/\/$/, "");
      });
    found.catch(() => pdses.delete(did));
    pdses.set(did, found);
  }
  return found;
}

/** The record at `uri`, as its account's PDS has it: null for none there. */
export async function getRecordAtPds(
  uri: string,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<{ uri: string; cid?: string; value: Record<string, unknown> } | null> {
  const [repo, collection, rkey] = uri.replace(/^at:\/\//, "").split("/");
  const pds = await pdsOf(repo, fetch);
  const nsid = "com.atproto.repo.getRecord";
  const res = await fetch(`${pds}/xrpc/${nsid}${searched({ repo, collection, rkey })}`);
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new XrpcError(nsid, res.status, await res.json().catch(() => null));
  return res.json();
}
