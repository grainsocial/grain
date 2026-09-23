import { views } from "$hatk";
import type { BaseContext, GrainActorProfile, GroupView } from "$hatk";
import { communityListing } from "../helpers/communityHost.ts";
import { lookupHandles } from "../helpers/lookupHandles.ts";

/**
 * Build group views for a set of community DIDs.
 *
 * A group is an account that (a) declared itself a community and (b) reads
 * like any other author. Its Grain profile is its identity, falling back to
 * the community's own profile as its host lists it (see communityListing);
 * its `social.grain.group.item` records are its pool. Who belongs is not
 * public — the roster is members-only — so there is no member count, and
 * whether the viewer belongs is theirs to say: `opts.mine`, the groups their
 * own PDS lists (see helpers/membership.ts).
 */
export async function hydrateGroups(
  ctx: BaseContext,
  dids: string[],
  opts: { gallery?: string; mine?: string[] } = {},
): Promise<GroupView[]> {
  if (dids.length === 0) return [];
  const ph = dids.map((_, i) => `$${i + 1}`).join(",");
  const viewer = ctx.viewer?.did;

  // One public read per community, cached: the profile and rules live in the
  // community's about space, which grain cannot read or index.
  const listings = new Map(
    await Promise.all(dids.map(async (did) => [did, await communityListing(did)] as const)),
  );

  const [profiles, handleMap, poolRows, pendingRows, submissionRows, itemRows, declineRows] =
    await Promise.all([
      ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids),
      lookupHandles(ctx.db, dids),
      ctx.db.query(
        `SELECT gi.did, COUNT(*) AS count, MAX(gi.created_at) AS last
         FROM "social.grain.group.item" gi JOIN "social.grain.gallery" g ON g.uri = gi.gallery
         WHERE gi.did IN (${ph}) GROUP BY gi.did`,
        dids,
      ) as Promise<{ did: string; count: number; last: string }[]>,
      // The queue only matters to whoever is acting as the group — the one
      // viewer whose DID is the group's.
      viewer && dids.includes(viewer)
        ? (ctx.db.query(
            `SELECT COUNT(*) AS count FROM "social.grain.group.submission" s
             WHERE s."group" = $1
               AND NOT EXISTS (SELECT 1 FROM "social.grain.group.item" i WHERE i.did = s."group" AND i.gallery = s.gallery)
               AND NOT EXISTS (SELECT 1 FROM "social.grain.group.decline" d WHERE d.did = s."group" AND d.submission = s.uri)`,
            [viewer],
          ) as Promise<{ count: number }[]>)
        : Promise.resolve([]),
      viewer && opts.gallery
        ? (ctx.db.query(
            `SELECT s.uri, s."group" AS grp FROM "social.grain.group.submission" s
             WHERE s.did = $1 AND s.gallery = $2 AND s."group" IN (${dids.map((_, i) => `$${i + 3}`).join(",")})`,
            [viewer, opts.gallery, ...dids],
          ) as Promise<{ uri: string; grp: string }[]>)
        : Promise.resolve([]),
      opts.gallery
        ? (ctx.db.query(
            `SELECT uri, did FROM "social.grain.group.item" WHERE gallery = $1 AND did IN (${dids.map((_, i) => `$${i + 2}`).join(",")})`,
            [opts.gallery, ...dids],
          ) as Promise<{ uri: string; did: string }[]>)
        : Promise.resolve([]),
      opts.gallery
        ? (ctx.db.query(
            `SELECT submission, did FROM "social.grain.group.decline" WHERE gallery = $1 AND did IN (${dids.map((_, i) => `$${i + 2}`).join(",")})`,
            [opts.gallery, ...dids],
          ) as Promise<{ submission: string; did: string }[]>)
        : Promise.resolve([]),
    ]);

  const pool = new Map(poolRows.map((r) => [r.did, r]));
  const mine = new Set(opts.mine ?? []);
  const submissionByGroup = new Map(submissionRows.map((r) => [r.grp, r.uri]));
  const itemByGroup = new Map(itemRows.map((r) => [r.did, r.uri]));
  const declined = new Set(declineRows.map((r) => r.submission));
  const pending = Number(pendingRows[0]?.count ?? 0);

  return dids.map((did) => {
    const p = profiles.get(did);
    const cp = listings.get(did);
    const acting = viewer === did;
    const member = mine.has(did);
    const submission = submissionByGroup.get(did);
    const item = itemByGroup.get(did);
    const standing = submission
      ? {
          uri: submission,
          status: item ? "accepted" : declined.has(submission) ? "declined" : "pending",
          ...(item ? { item } : {}),
        }
      : item
        ? { uri: item, status: "accepted", item }
        : undefined;
    const joinPolicy = cp?.joinPolicy?.split("#").pop();
    // A rule's address is its record in the about space, which is what a
    // moderation label cites.
    const rules = cp?.rules?.map((r) => ({
      uri: `at://${did}/space/fyi.opensocial.about/self/${did}/fyi.opensocial.rule/${r.rkey}`,
      title: r.title,
      ...(r.text ? { text: r.text } : {}),
    }));
    return views.groupView({
      did,
      handle: p?.handle ?? handleMap.get(did) ?? did,
      displayName: p?.value.displayName ?? cp?.displayName,
      description: p?.value.description ?? cp?.description,
      avatar: (p ? ctx.blobUrl(did, p.value.avatar, "avatar") : undefined) ?? cp?.avatarUrl,
      // Where the community is actually run. Grain shows a group; the
      // community's own site is where its calendar, its boards and its
      // moderation live, and this is the only place that fact is published.
      ...(cp?.url ? { url: cp.url } : {}),
      poolCount: Number(pool.get(did)?.count ?? 0),
      ...(joinPolicy ? { joinPolicy } : {}),
      ...(rules?.length ? { rules } : {}),
      ...(pool.get(did)?.last ? { lastActivityAt: pool.get(did)!.last } : {}),
      ...(acting ? { pendingCount: pending } : {}),
      ...(acting || member || standing
        ? {
            viewer: {
              ...(acting ? { acting } : {}),
              ...(member ? { member } : {}),
              ...(standing ? { submission: standing } : {}),
            },
          }
        : {}),
    });
  });
}

/** DID or handle → DID, or null when unknown. */
export async function resolveGroupActor(ctx: BaseContext, actor: string): Promise<string | null> {
  let did = actor;
  if (!did.startsWith("did:")) {
    const rows = (await ctx.db.query(`SELECT did FROM _repos WHERE handle = $1`, [actor])) as {
      did: string;
    }[];
    if (!rows[0]?.did) return null;
    did = rows[0].did;
  }
  const declared = (await ctx.db.query(
    `SELECT 1 AS v FROM "fyi.opensocial.declaration" WHERE did = $1 LIMIT 1`,
    [did],
  )) as { v: number }[];
  return declared.length ? did : null;
}
