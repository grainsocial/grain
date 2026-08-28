import { views } from "$hatk";
import type { BaseContext, GrainActorProfile, GroupView } from "$hatk";
import { lookupHandles } from "../helpers/lookupHandles.ts";

/** The SQL for "did is on group's public roster". Both sides are DIDs. */
export const memberOf = (memberDid: string, groupDid: string) =>
  `EXISTS (SELECT 1 FROM "community.opensocial.member" m WHERE m.did = ${groupDid} AND m.member = ${memberDid})`;

/**
 * Build group views for a set of community DIDs.
 *
 * A group is an account that (a) declared itself a community and (b) reads
 * like any other author. Its Grain profile is its identity (falling back to
 * the community's own public profile), its `social.grain.group.item` records
 * are its pool, and its `community.opensocial.member` records — the roster
 * the host publishes for a discoverable community — say who belongs. Nothing
 * here talks to the host: every fact is a public record already indexed.
 */
export async function hydrateGroups(
  ctx: BaseContext,
  dids: string[],
  opts: { gallery?: string } = {},
): Promise<GroupView[]> {
  if (dids.length === 0) return [];
  const ph = dids.map((_, i) => `$${i + 1}`).join(",");
  const viewer = ctx.viewer?.did;

  const [
    profiles,
    communityProfiles,
    handleMap,
    poolRows,
    memberRows,
    viewerMemberRows,
    ruleRows,
    pendingRows,
    submissionRows,
    itemRows,
    declineRows,
  ] = await Promise.all([
    ctx.lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids),
    ctx.db.query(
      `SELECT did, display_name, description, avatar, join_policy FROM "community.opensocial.profile" WHERE did IN (${ph})`,
      dids,
    ) as Promise<
      {
        did: string;
        display_name: string;
        description: string | null;
        avatar: string | null;
        join_policy: string;
      }[]
    >,
    lookupHandles(ctx.db, dids),
    // The pool is members' galleries only — same rule as the feeds, so the
    // count and the grid agree when someone has been ejected.
    ctx.db.query(
      `SELECT gi.did, COUNT(*) AS count, MAX(gi.created_at) AS last
         FROM "social.grain.group.item" gi JOIN "social.grain.gallery" g ON g.uri = gi.gallery
         WHERE gi.did IN (${ph}) AND ${memberOf("g.did", "gi.did")} GROUP BY gi.did`,
      dids,
    ) as Promise<{ did: string; count: number; last: string }[]>,
    ctx.db.query(
      `SELECT did, COUNT(*) AS count FROM "community.opensocial.member" WHERE did IN (${ph}) GROUP BY did`,
      dids,
    ) as Promise<{ did: string; count: number }[]>,
    viewer
      ? (ctx.db.query(
          `SELECT did FROM "community.opensocial.member" WHERE member = $1 AND did IN (${dids.map((_, i) => `$${i + 2}`).join(",")})`,
          [viewer, ...dids],
        ) as Promise<{ did: string }[]>)
      : Promise.resolve([]),
    ctx.db.query(
      `SELECT did, uri, title, text FROM "community.opensocial.rule" WHERE did IN (${ph}) ORDER BY created_at ASC`,
      dids,
    ) as Promise<{ did: string; uri: string; title: string; text: string | null }[]>,
    // The queue only matters to whoever is acting as the group — the one
    // viewer whose DID is the group's. Members' submissions only; a
    // stranger's (or an ejected member's) never reaches it.
    viewer && dids.includes(viewer)
      ? (ctx.db.query(
          `SELECT COUNT(*) AS count FROM "social.grain.group.submission" s
             WHERE s."group" = $1
               AND ${memberOf("s.did", 's."group"')}
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
  const members = new Map(memberRows.map((r) => [r.did, Number(r.count)]));
  const viewerMemberOf = new Set(viewerMemberRows.map((r) => r.did));
  const cprofile = new Map(communityProfiles.map((r) => [r.did, r]));
  const rules = new Map<string, { uri: string; title: string; text?: string }[]>();
  for (const r of ruleRows) {
    const list = rules.get(r.did) ?? [];
    list.push({ uri: r.uri, title: r.title, ...(r.text ? { text: r.text } : {}) });
    rules.set(r.did, list);
  }
  const submissionByGroup = new Map(submissionRows.map((r) => [r.grp, r.uri]));
  const itemByGroup = new Map(itemRows.map((r) => [r.did, r.uri]));
  const declined = new Set(declineRows.map((r) => r.submission));
  const pending = Number(pendingRows[0]?.count ?? 0);

  return dids.map((did) => {
    const p = profiles.get(did);
    const cp = cprofile.get(did);
    const acting = viewer === did;
    const member = viewerMemberOf.has(did);
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
    const joinPolicy = cp?.join_policy?.split("#").pop();
    return views.groupView({
      did,
      handle: p?.handle ?? handleMap.get(did) ?? did,
      displayName: p?.value.displayName ?? cp?.display_name,
      description: p?.value.description ?? cp?.description ?? undefined,
      avatar:
        (p ? ctx.blobUrl(did, p.value.avatar, "avatar") : undefined) ??
        (cp?.avatar ? ctx.blobUrl(did, cp.avatar, "avatar") : undefined),
      poolCount: Number(pool.get(did)?.count ?? 0),
      memberCount: members.get(did) ?? 0,
      ...(joinPolicy ? { joinPolicy } : {}),
      ...(rules.has(did) ? { rules: rules.get(did) } : {}),
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
    `SELECT 1 AS v FROM "community.opensocial.declaration" WHERE did = $1 LIMIT 1`,
    [did],
  )) as { v: number }[];
  return declared.length ? did : null;
}
