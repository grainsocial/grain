// Which groups the viewer is in, and the viewer's half of being in one.
//
// A group's roster is members-only: it lives in the group's members
// space, which grain cannot index and a stranger cannot read. What grain can
// read is the viewer's own side. Membership is bidirectional — the group
// writes a `membership`, the member writes an `acceptance` into the same space,
// in their own repo — so the viewer's PDS holds a repo in the members space of
// every group they have accepted, and `listSpaces` on that PDS lists them.
// Private, and no probing every group on the network.
//
// That list is only candidates. A PDS keeps listing a space after the
// acceptance in it is deleted — the repo stays, empty — and it stores an
// acceptance from someone the group has not admitted, because the host is
// told about the write only afterwards and refuses it there. So every
// candidate is confirmed the way the host decides it: a credential for the
// members space, which only members may read.

import { forgetCredential, type PdsCall, spaceCredential } from "../spaces/client.ts";

export const MEMBERS_SPACE_TYPE = "fyi.opensocial.members";
const ACCEPTANCE = "fyi.opensocial.acceptance";

/** `at://<group>/space/fyi.opensocial.members/self`. */
export function membersSpaceOf(group: string): string {
  return `at://${group}/space/${MEMBERS_SPACE_TYPE}/self`;
}

/** Groups the viewer's PDS lists a members-space repo for. Unconfirmed. */
export async function candidateGroups(pds: PdsCall): Promise<string[]> {
  const out = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = (await pds("com.atproto.space.listSpaces", {
      params: { type: MEMBERS_SPACE_TYPE, limit: 100, ...(cursor ? { cursor } : {}) },
    })) as { spaces?: { uri: string }[]; cursor?: string };
    for (const s of res.spaces ?? []) {
      const did = /^at:\/\/(did:[^/]+)\/space\//.exec(s.uri)?.[1];
      if (did) out.add(did);
    }
    cursor = res.cursor;
  } while (cursor);
  return [...out];
}

type Db = { query: (sql: string, params?: unknown[]) => Promise<unknown[]> };

/**
 * Whether this account is a group itself.
 *
 * A group is not a member of groups, and whoever signs in as one is granted
 * none of what asking would take: its host withholds the members-space scope,
 * because a group's roles confer nothing in other groups. Asking anyway is
 * worse than a no — a PDS answers a missing scope with ScopeMissingError, and
 * hatk ends the session on that, signing the group out of Grain on the first
 * page that looks.
 */
async function isGroup(db: Db, did: string): Promise<boolean> {
  const rows = await db.query(
    `SELECT 1 AS v FROM "fyi.opensocial.declaration" WHERE did = $1 LIMIT 1`,
    [did],
  );
  return rows.length > 0;
}

// A refusal is remembered briefly, so a page reloaded by a non-member does not
// mint a delegation token each time. A yes needs no cache of its own:
// spaceCredential already holds the credential.
const refused = new Map<string, number>();
const REFUSED_TTL_MS = 2 * 60_000;

/**
 * Whether the host admits the viewer to this group's members space.
 * `fresh` skips a remembered refusal: the group's own page is where someone
 * admitted elsewhere turns up, and it should not tell them no for two minutes.
 */
export async function isMember(
  db: Db,
  pds: PdsCall,
  viewerDid: string,
  group: string,
  opts: { fresh?: boolean } = {},
): Promise<boolean> {
  if (await isGroup(db, viewerDid)) return false;
  const key = `${viewerDid} ${group}`;
  if (!opts.fresh && Date.now() - (refused.get(key) ?? 0) < REFUSED_TTL_MS) return false;
  try {
    await spaceCredential(pds, viewerDid, membersSpaceOf(group));
    refused.delete(key);
    return true;
  } catch {
    refused.set(key, Date.now());
    return false;
  }
}

/** The groups the viewer is in: their PDS's candidates, each confirmed with the host. */
export async function groupsOf(db: Db, pds: PdsCall, viewerDid: string): Promise<string[]> {
  if (await isGroup(db, viewerDid)) return [];
  const candidates = await candidateGroups(pds);
  const confirmed = await Promise.all(candidates.map((g) => isMember(db, pds, viewerDid, g)));
  return candidates.filter((_, i) => confirmed[i]);
}

/** Forget a refusal, after something that may have changed the answer. */
export function forgetRefusal(viewerDid: string, group: string) {
  refused.delete(`${viewerDid} ${group}`);
}

/** After leaving: the credential still cached would say they are in. */
export function forgetMembership(viewerDid: string, group: string) {
  forgetCredential(viewerDid, membersSpaceOf(group));
  refused.set(`${viewerDid} ${group}`, Date.now());
}

/**
 * Write the viewer's acceptance. Only for someone already confirmed a member:
 * their PDS would store it either way, and an acceptance nobody admitted is a
 * candidate that never confirms.
 */
export async function acceptMembership(pds: PdsCall, viewerDid: string, group: string) {
  await pds("com.atproto.space.putRecord", {
    method: "POST",
    body: {
      space: membersSpaceOf(group),
      repo: viewerDid,
      collection: ACCEPTANCE,
      rkey: "self",
      validate: false,
      record: { $type: ACCEPTANCE, createdAt: new Date().toISOString() },
    },
  });
}

/** Take the acceptance back. Before leaving: once out, the space refuses the delete. */
export async function withdrawAcceptance(pds: PdsCall, viewerDid: string, group: string) {
  await pds("com.atproto.space.deleteRecord", {
    method: "POST",
    body: { space: membersSpaceOf(group), repo: viewerDid, collection: ACCEPTANCE, rkey: "self" },
  });
}
