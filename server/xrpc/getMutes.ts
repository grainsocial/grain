import { defineQuery, InvalidRequestError, type GrainActorProfile } from "$hatk";

export default defineQuery("social.grain.unspecced.getMutes", async (ctx) => {
  const { ok, db, lookup, blobUrl, packCursor, unpackCursor, viewer } = ctx;
  if (!viewer) throw new InvalidRequestError("Authentication required");

  const { limit = 50, cursor } = ctx.params;
  const offset = cursor ? Number(unpackCursor(cursor)?.primary ?? 0) : 0;

  const rows = (await db.query(
    `SELECT subject, created_at FROM _mutes
     WHERE did = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [viewer.did, Number(limit) + 1, offset],
  )) as { subject: string; created_at: string }[];

  const hasMore = rows.length > Number(limit);
  const page = hasMore ? rows.slice(0, Number(limit)) : rows;
  const dids = page.map((r) => r.subject);

  const profiles = await lookup<GrainActorProfile>(
    "social.grain.actor.profile",
    "did",
    dids,
  );

  const handleRows =
    dids.length > 0
      ? ((await db.query(
          `SELECT did, handle FROM _repos WHERE did IN (${dids.map((_, i) => `$${i + 1}`).join(",")})`,
          dids,
        )) as { did: string; handle: string }[])
      : [];
  const handleMap = new Map(handleRows.map((r) => [r.did, r.handle]));

  const items = page.map((row) => {
    const p = profiles.get(row.subject);
    return {
      did: row.subject,
      handle: p?.handle ?? handleMap.get(row.subject) ?? row.subject,
      displayName: p?.value.displayName,
      avatar: p ? (blobUrl(row.subject, p.value.avatar, "avatar") ?? undefined) : undefined,
    };
  });

  const nextOffset = offset + Number(limit);
  const lastRow = page[page.length - 1];

  return ok({
    items,
    ...(hasMore && lastRow ? { cursor: packCursor(nextOffset, lastRow.created_at) } : {}),
  });
});
