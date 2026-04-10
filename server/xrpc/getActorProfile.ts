import { defineQuery, InvalidRequestError } from "$hatk";
import type { GrainActorProfile, Declaration } from "$hatk";

export default defineQuery("social.grain.unspecced.getActorProfile", async (ctx) => {
  const { ok, params, isTakendown, lookup, count, blobUrl, viewer: authViewer } = ctx;
  const viewer = authViewer?.did ?? params.viewer;

  // Resolve handle to DID if needed
  let actor = params.actor;
  if (!actor.startsWith("did:")) {
    const rows = (await ctx.db.query(`SELECT did FROM _repos WHERE handle = $1`, [actor])) as {
      did: string;
    }[];
    if (rows[0]?.did) {
      actor = rows[0].did;
    } else {
      throw new InvalidRequestError("Actor not found");
    }
  }

  if (await isTakendown(actor)) {
    return ok({ did: actor, handle: actor, cid: "" });
  }

  const [
    profiles,
    germDeclarations,
    galleryCounts,
    followerCounts,
    followsCounts,
    viewerFollowingRows,
    followedByRows,
    viewerBlockingRows,
    blockedByRows,
    viewerMutedRows,
  ] = await Promise.all([
    lookup<GrainActorProfile>("social.grain.actor.profile", "did", [actor]),
    lookup<Declaration>("com.germnetwork.declaration", "did", [actor]),
    count("social.grain.gallery", "did", [actor]),
    ctx.db
      .query(
        `SELECT COUNT(DISTINCT did) as count FROM "social.grain.graph.follow" WHERE subject = $1`,
        [actor],
      )
      .then((r: any) => {
        const m = new Map();
        m.set(actor, Number(r[0]?.count || 0));
        return m;
      }),
    ctx.db
      .query(
        `SELECT COUNT(DISTINCT subject) as count FROM "social.grain.graph.follow" WHERE did = $1`,
        [actor],
      )
      .then((r: any) => {
        const m = new Map();
        m.set(actor, Number(r[0]?.count || 0));
        return m;
      }),
    ...(viewer && viewer !== actor
      ? [
          ctx.db.query(
            `SELECT uri FROM "social.grain.graph.follow" WHERE did = $1 AND subject = $2 LIMIT 1`,
            [viewer, actor],
          ) as Promise<{ uri: string }[]>,
          ctx.db.query(
            `SELECT uri FROM "social.grain.graph.follow" WHERE did = $1 AND subject = $2 LIMIT 1`,
            [actor, viewer],
          ) as Promise<{ uri: string }[]>,
          ctx.db.query(
            `SELECT uri FROM "social.grain.graph.block" WHERE did = $1 AND subject = $2 LIMIT 1`,
            [viewer, actor],
          ) as Promise<{ uri: string }[]>,
          ctx.db.query(
            `SELECT uri FROM "social.grain.graph.block" WHERE did = $1 AND subject = $2 LIMIT 1`,
            [actor, viewer],
          ) as Promise<{ uri: string }[]>,
          ctx.db.query(
            `SELECT 1 as v FROM _mutes WHERE did = $1 AND subject = $2 LIMIT 1`,
            [viewer, actor],
          ) as Promise<{ v: number }[]>,
        ]
      : [Promise.resolve([]), Promise.resolve([]), Promise.resolve([]), Promise.resolve([]), Promise.resolve([])]),
  ]);
  const viewerFollowing = (viewerFollowingRows as { uri: string }[])[0]?.uri ?? null;
  const followedBy = (followedByRows as { uri: string }[])[0]?.uri ?? null;
  const viewerBlocking = (viewerBlockingRows as { uri: string }[])?.[0]?.uri ?? null;
  const blockedBy = !!(blockedByRows as { uri: string }[])?.[0]?.uri;
  const viewerMuted = !!(viewerMutedRows as { v: number }[])?.[0];

  const profile = profiles.get(actor);
  const germDecl = germDeclarations.get(actor);
  const messageMe = germDecl?.value.messageMe;
  const galleryCount = galleryCounts.get(actor) || 0;
  const followersCount = followerCounts.get(actor) || 0;
  const followsCount = followsCounts.get(actor) || 0;

  if (!profile) {
    const repos = (await ctx.db.query("SELECT handle FROM _repos WHERE did = $1", [actor])) as {
      handle: string;
    }[];
    return ok({
      cid: "",
      did: actor,
      handle: repos[0]?.handle || actor,
      galleryCount,
      followersCount,
      followsCount,
      messageMe,
    });
  }

  return ok({
    cid: profile.cid,
    did: profile.did,
    handle: profile.handle ?? profile.did,
    displayName: profile.value.displayName,
    description: profile.value.description,
    avatar: blobUrl(profile.did, profile.value.avatar, "avatar"),
    galleryCount,
    followersCount,
    followsCount,
    createdAt: profile.value.createdAt,
    messageMe,
    ...(viewer && viewer !== actor && (viewerFollowing || followedBy || viewerBlocking || blockedBy || viewerMuted)
      ? {
          viewer: {
            // Hide follow relationships when either party blocks the other
            ...(!viewerBlocking && !blockedBy && viewerFollowing ? { following: viewerFollowing } : {}),
            ...(!viewerBlocking && !blockedBy && followedBy ? { followedBy: followedBy } : {}),
            ...(viewerBlocking ? { blocking: viewerBlocking } : {}),
            ...(blockedBy ? { blockedBy: true } : {}),
            ...(viewerMuted ? { muted: true } : {}),
          },
        }
      : {}),
  });
});
