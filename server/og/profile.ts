import { defineOG } from "$hatk";
import type { GrainActorProfile } from "$hatk";
import { fallbackFonts } from "./fonts.ts";

export default defineOG("/og/profile/:did", async (ctx) => {
  const { db, params, fetchImage, lookup, blobUrl } = ctx;
  const { did } = params;

  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", [did]);
  const author = profiles.get(did);
  const displayName = author?.value.displayName || author?.handle || did.slice(0, 24);
  const handle = author?.handle || did.slice(0, 24);
  const description = author?.value.description || "";
  const avatarRef = author ? blobUrl(did, author.value.avatar) : null;
  const avatarDataUrl = avatarRef ? await fetchImage(avatarRef) : null;

  // Fetch gallery count and follower/following counts
  const [galleryCount, followerCount, followingCount] = await Promise.all([
    db.query(`SELECT count(*) as cnt FROM "social.grain.gallery" WHERE did = $1`, [did]) as Promise<
      Array<{ cnt: number }>
    >,
    db.query(`SELECT count(*) as cnt FROM "social.grain.graph.follow" WHERE subject = $1`, [
      did,
    ]) as Promise<Array<{ cnt: number }>>,
    db.query(`SELECT count(*) as cnt FROM "social.grain.graph.follow" WHERE did = $1`, [
      did,
    ]) as Promise<Array<{ cnt: number }>>,
  ]);

  const galleries = galleryCount[0]?.cnt ?? 0;
  const followers = followerCount[0]?.cnt ?? 0;
  const following = followingCount[0]?.cnt ?? 0;

  // Fetch recent gallery thumbnails (up to 4)
  const recentRows = (await db.query(
    `SELECT gi.item, gi.gallery FROM "social.grain.gallery.item" gi
       JOIN "social.grain.gallery" g ON g.uri = gi.gallery
       WHERE g.did = $1
       ORDER BY g.created_at DESC, gi.position ASC
       LIMIT 4`,
    [did],
  )) as Array<{ item: string; gallery: string }>;

  const thumbs: string[] = [];
  if (recentRows.length > 0) {
    const photoUris = recentRows.map((r) => r.item);
    const photoRecords = await ctx.getRecords<import("$hatk").Photo>(
      "social.grain.photo",
      photoUris,
    );
    for (const uri of photoUris) {
      const rec = photoRecords.get(uri);
      if (!rec) continue;
      const url = blobUrl(rec.did, rec.value.photo, "feed_thumbnail");
      if (!url) continue;
      const dataUrl = await fetchImage(url);
      if (dataUrl) thumbs.push(dataUrl);
    }
  }

  const statStyle = {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center" as const,
    gap: "2px",
  };
  const statNum = { fontSize: 22, fontWeight: 700, color: "white" };
  const statLabel = { fontSize: 13, color: "#64748b" };

  return {
    element: {
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#080b12",
          color: "white",
          padding: "40px",
        },
        children: [
          // Left: avatar + info
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "400px",
                gap: "16px",
              },
              children: [
                ...(avatarDataUrl
                  ? [
                      {
                        type: "img",
                        props: {
                          src: avatarDataUrl,
                          width: 120,
                          height: 120,
                          style: { borderRadius: "60px", objectFit: "cover" as const },
                        },
                      },
                    ]
                  : [
                      {
                        type: "div",
                        props: {
                          style: {
                            width: "120px",
                            height: "120px",
                            borderRadius: "60px",
                            background: "#1e293b",
                          },
                        },
                      },
                    ]),
                {
                  type: "div",
                  props: {
                    children: displayName,
                    style: { fontSize: 32, fontWeight: 700, textAlign: "center" as const },
                  },
                },
                {
                  type: "div",
                  props: { children: `@${handle}`, style: { fontSize: 18, color: "#94a3b8" } },
                },
                {
                  type: "div",
                  props: {
                    style: { display: "flex", gap: "32px", marginTop: "8px" },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: statStyle,
                          children: [
                            { type: "div", props: { style: statNum, children: `${galleries}` } },
                            { type: "div", props: { style: statLabel, children: "galleries" } },
                          ],
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: statStyle,
                          children: [
                            { type: "div", props: { style: statNum, children: `${followers}` } },
                            { type: "div", props: { style: statLabel, children: "followers" } },
                          ],
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: statStyle,
                          children: [
                            { type: "div", props: { style: statNum, children: `${following}` } },
                            { type: "div", props: { style: statLabel, children: "following" } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          // Right: recent photos grid
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                flex: "1",
                alignContent: "center",
                justifyContent: "center",
              },
              children: thumbs.map((src) => ({
                type: "img",
                props: {
                  src,
                  width: thumbs.length <= 2 ? 340 : 180,
                  height: thumbs.length <= 2 ? 340 : 180,
                  style: { objectFit: "cover", borderRadius: "12px" },
                },
              })),
            },
          },
        ],
      },
    },
    options: { fonts: fallbackFonts() },
    meta: {
      title: `${displayName} (@${handle}) — Grain`,
      description: description || `@${handle} on Grain`,
    },
  };
});
