// Reading and writing a permissioned space (proposal 0016) on behalf of a viewer.
//
// A space's records never reach a firehose, so none of this is indexed: a
// private gallery is assembled by reading the repos that hold it, at request
// time, from the hosts that hold them. That is the role the PDS deliberately
// does not play.
//
// Two ways in, and which one applies depends only on who is asking:
//
//   the author   — their own session, proxied through ctx.pds, because the
//                  records are in their own repo on their own PDS
//   a reader     — a space credential: hatk trades their PDS session for a
//                  delegation token and presents that to the authority
//                  (`ctx.spaceCredential`)
//
// The credential is signed by the authority, so every repo host in the space
// verifies it without contacting them.

import config from "../../hatk.config.ts";

export const GALLERY_SPACE_TYPE = "social.grain.privateGallery";

/**
 * A group's pool of galleries, as a space of its own.
 *
 * Not a gallery space: the authority is the group rather than an author,
 * every member writes into it, and there is one of it — so the skey is fixed
 * and the uri follows from the group's DID. Its type is declared at
 * `social.grain.group`, which is also what a member's PDS resolves when it is
 * asked for the scope to write here.
 */
export const POOL_SPACE_TYPE = "social.grain.group";

/** `at://<group>/space/social.grain.group/self` — the pool a group keeps. */
export function poolUri(group: string): string {
  return `at://${group}/space/${POOL_SPACE_TYPE}/self`;
}

/** Call an XRPC method on the viewer's own PDS. Shape of hatk's `ctx.pds`. */
export type PdsCall = (
  nsid: string,
  options?: {
    method?: "GET" | "POST";
    params?: Record<string, string | number | boolean | string[] | undefined>;
    body?: unknown;
  },
) => Promise<Record<string, unknown>>;

/** A space credential as hatk hands it over: a fetch that presents it. */
export interface SpaceCredential {
  fetch: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

/** What a space read needs from hatk's handler context, as the viewer. */
export interface SpaceReader {
  pds: PdsCall;
  spaceCredential: (space: string, opts?: { refresh?: boolean }) => Promise<SpaceCredential>;
}

export class SpaceError extends Error {
  // Assigned in the body rather than declared as a constructor parameter
  // property: the server runs this TypeScript through Node's type stripping,
  // which erases annotations and cannot emit the assignment a parameter
  // property implies.
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** `at://<authority>/space/<type>/<skey>` — the space a private gallery is. */
export function spaceUri(authority: string, skey: string): string {
  return `at://${authority}/space/${GALLERY_SPACE_TYPE}/${skey}`;
}

/** The authority DID and skey named by a space URI. */
export function parseSpaceUri(uri: string): { authority: string; skey: string } {
  const match = uri.match(/^at:\/\/([^/]+)\/space\/([^/]+)\/([^/]+)$/);
  if (!match) throw new SpaceError(400, `Not a space uri: ${uri}`);
  return { authority: match[1], skey: match[3] };
}

// --- A gallery's space and its readers, on the author's own PDS ----------------
//
// Three servers serve these, under two sets of names. The reference
// `@atproto/pds` alpha, since 0.0.0-spaces-alpha-20261029171913, creates a
// space with com.atproto.space.createSpace and keeps its member list under
// com.atproto.memberspace. pds.js and zds still answer to
// com.atproto.simplespace, with the proposal's shape (see AGENTS.md, "The second
// implementation"). Each call asks the reference name first and the older one
// when the server says it has no such method.

type PdsAttempt = { nsid: string } & NonNullable<Parameters<PdsCall>[1]>;

/** A server's way of saying it serves no such method: pds.js's 501, zds's 404. */
function notServed(err: unknown): boolean {
  const status = (err as { status?: unknown })?.status;
  return status === 404 || status === 501;
}

/** The first of `attempts` the PDS serves. Any other failure is the answer. */
async function firstServed(pds: PdsCall, attempts: PdsAttempt[]): Promise<Record<string, unknown>> {
  for (const [i, { nsid, ...options }] of attempts.entries()) {
    try {
      return await pds(nsid, options);
    } catch (err) {
      if (i === attempts.length - 1 || !notServed(err)) throw err;
    }
  }
  throw new Error("no attempts");
}

/** Make the space a private gallery is, anchored on its author, readable by its member list. */
export function createGallerySpace(pds: PdsCall, author: string, skey: string) {
  return firstServed(pds, [
    {
      nsid: "com.atproto.space.createSpace",
      method: "POST",
      body: {
        spaceType: GALLERY_SPACE_TYPE,
        skey,
        policy: { $type: "com.atproto.memberspace.policy" },
      },
    },
    {
      // `did` names the authority: pds.js infers it from the session, zds
      // requires it. The config is nested, with the policy as a bare string,
      // the one spelling both read.
      nsid: "com.atproto.simplespace.createSpace",
      method: "POST",
      body: {
        did: author,
        type: GALLERY_SPACE_TYPE,
        skey,
        config: {
          policy: "member-list",
          appAccess: { $type: "com.atproto.simplespace.defs#open" },
        },
      },
    },
  ]);
}

/** Let `did` read a gallery. Only its author writes, so a member never does. */
export function addGalleryReader(pds: PdsCall, space: string, did: string) {
  return firstServed(pds, [
    {
      nsid: "com.atproto.memberspace.putMember",
      method: "POST",
      body: { space, did, read: true, write: false },
    },
    { nsid: "com.atproto.simplespace.addMember", method: "POST", body: { space, did } },
  ]);
}

/** A gallery's member list, as its authority keeps it. */
export function listGalleryMembers(pds: PdsCall, space: string, limit: number) {
  return firstServed(
    pds,
    ["com.atproto.memberspace.listMembers", "com.atproto.simplespace.listMembers"].map((nsid) => ({
      nsid,
      method: "GET" as const,
      params: { space, limit },
    })),
  );
}

// --- Identity ---------------------------------------------------------------

const pdsCache = new Map<string, { endpoint: string; expires: number }>();
const PDS_CACHE_TTL_MS = 60 * 60 * 1000;

/** Where an account's repo lives, from its DID document. */
export async function resolvePds(did: string): Promise<string> {
  const cached = pdsCache.get(did);
  if (cached && cached.expires > Date.now()) return cached.endpoint;

  let doc: { service?: { id?: string; type?: string; serviceEndpoint?: string }[] } | null = null;
  if (did.startsWith("did:plc:")) {
    const res = await fetch(`${config.plc}/${encodeURIComponent(did)}`);
    if (res.ok) doc = await res.json();
  } else if (did.startsWith("did:web:")) {
    const host = decodeURIComponent(did.slice("did:web:".length)).replace(/:/g, "/");
    const res = await fetch(`https://${host}/.well-known/did.json`);
    if (res.ok) doc = await res.json();
  }

  const endpoint = doc?.service?.find(
    (s) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer",
  )?.serviceEndpoint;
  if (!endpoint) throw new SpaceError(502, `Could not resolve a PDS for ${did}`);

  pdsCache.set(did, { endpoint, expires: Date.now() + PDS_CACHE_TTL_MS });
  return endpoint;
}

// --- Reads ------------------------------------------------------------------

async function credentialedGet(
  credential: SpaceCredential,
  endpoint: string,
  nsid: string,
  params: Record<string, string | undefined>,
): Promise<Response> {
  const url = new URL(`${endpoint}/xrpc/${nsid}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.append(k, v);
  }
  return credential.fetch(url);
}

/**
 * Read from a repo in a space, as a viewer who does not own it.
 *
 * A 401 is retried once with a freshly minted credential: the host refused one
 * that had not expired by our clock — skew, or the authority revoked it — and
 * the alternative is a failed page load over a token we could simply replace.
 * A viewer who may not read the space is refused at the mint, with the
 * authority's status.
 */
export async function readSpace(
  reader: SpaceReader,
  space: string,
  host: string,
  nsid: string,
  params: Record<string, string | undefined>,
): Promise<Record<string, unknown>> {
  for (const attempt of [0, 1]) {
    const credential = await reader.spaceCredential(space, { refresh: attempt === 1 });
    const res = await credentialedGet(credential, host, nsid, params);
    if (res.ok) return (await res.json()) as Record<string, unknown>;
    if (res.status !== 401 || attempt === 1) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new SpaceError(res.status, body.message || `${nsid} failed`);
    }
  }
  throw new SpaceError(500, "unreachable");
}

/**
 * The CID of a blob a space record references.
 *
 * Two spellings of the same thing: `com.atproto.repo.listRecords` hands over
 * the lexicon's `$link`, while a space read hands over the DAG-JSON `/` the
 * record was stored as. Servers differ on which they give, so read both.
 */
export function blobCid(blob: unknown): string | undefined {
  const ref = (blob as { ref?: { $link?: string; "/"?: string } } | undefined)?.ref;
  return ref?.$link ?? ref?.["/"];
}

/**
 * A record as a space lists it. There is no `uri`: a space record's address is
 * the space, the repo, the collection and the rkey, and the caller already knows
 * the first two — so callers build whatever URI they need from the rkey.
 */
export interface SpaceRecord {
  collection: string;
  rkey: string;
  cid: string;
  value: Record<string, unknown>;
}

/**
 * Every record of one collection in one repo of a space.
 *
 * The author reads their own repo through their own session; anyone else needs
 * a credential. Both land on the same endpoint at the same host.
 */
export async function listSpaceRecords(
  reader: SpaceReader,
  viewerDid: string,
  space: string,
  repo: string,
  collection: string,
  limit = 100,
): Promise<SpaceRecord[]> {
  const params = { space, repo, collection, limit: String(limit) };

  const body =
    viewerDid === repo
      ? await reader.pds("com.atproto.space.listRecords", { method: "GET", params })
      : await readSpace(
          reader,
          space,
          await resolvePds(repo),
          "com.atproto.space.listRecords",
          params,
        );

  return (body.records ?? []) as SpaceRecord[];
}

/**
 * The accounts that have written to a space, from its authority.
 *
 * A credential every time, including the authority's own: this is the space's
 * writer set rather than one repo's records, and a server may serve it to
 * credential holders only — zds does — so a session gets a 401 here even from
 * the account that owns the space.
 */
export async function listSpaceRepos(
  reader: SpaceReader,
  space: string,
): Promise<{ did: string; repoRev: string }[]> {
  const { authority } = parseSpaceUri(space);
  const body = await readSpace(
    reader,
    space,
    await resolvePds(authority),
    "com.atproto.space.listRepos",
    { space },
  );

  return (body.repos ?? []) as { did: string; repoRev: string }[];
}
