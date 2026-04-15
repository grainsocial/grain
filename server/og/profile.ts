import { defineOG } from "$hatk";
import type { GrainActorProfile, Photo } from "$hatk";
import { allFonts } from "./fonts.ts";
import { calculateCollageLayout } from "./collage.ts";

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

  // Fetch first photo from each of the latest 10 galleries
  const recentRows = (await db.query(
    `SELECT gi.item, g.uri AS gallery FROM "social.grain.gallery.item" gi
       JOIN "social.grain.gallery" g ON g.uri = gi.gallery
       WHERE g.did = $1 AND gi.position = 0
       ORDER BY g.created_at DESC
       LIMIT 10`,
    [did],
  )) as Array<{ item: string; gallery: string }>;

  const imageData: Array<{ url: string; aspectRatio: number }> = [];
  if (recentRows.length > 0) {
    const photoUris = recentRows.map((r) => r.item);
    const photoRecords = await ctx.getRecords<Photo>("social.grain.photo", photoUris);
    for (const uri of photoUris) {
      const rec = photoRecords.get(uri);
      if (!rec) continue;
      const url = blobUrl(rec.did, rec.value.photo, "feed_thumbnail");
      if (!url) continue;
      const dataUrl = await fetchImage(url);
      if (!dataUrl) continue;
      const ar = rec.value.aspectRatio
        ? rec.value.aspectRatio.width / rec.value.aspectRatio.height
        : 4 / 3;
      imageData.push({ url: dataUrl, aspectRatio: ar });
    }
  }

  const width = 1200;
  const height = 630;
  const titleBarHeight = 100;
  const collageHeight = height - titleBarHeight;
  const gap = 12;
  const padding = 24;

  const placements = calculateCollageLayout(
    imageData,
    width - padding * 2,
    collageHeight - padding * 2,
    gap,
  );

  return {
    element: {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          position: "relative",
        },
        children: [
          // Collage area
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                width: `${width}px`,
                height: `${collageHeight}px`,
                position: "relative",
                padding: `${padding}px`,
              },
              children: placements.map(
                (p: {
                  item: { url: string };
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                }) => ({
                  type: "img",
                  props: {
                    src: p.item.url,
                    style: {
                      position: "absolute",
                      left: `${p.x + padding}px`,
                      top: `${p.y + padding}px`,
                      width: `${p.width}px`,
                      height: `${p.height}px`,
                      objectFit: "cover",
                    },
                  },
                }),
              ),
            },
          },
          // Title bar
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                bottom: "0",
                left: "0",
                right: "0",
                height: `${titleBarHeight}px`,
                background: "#ffffff",
                display: "flex",
                alignItems: "flex-end",
                padding: "0 24px 20px 24px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      width: "100%",
                    },
                    children: [
                      ...(avatarDataUrl
                        ? [
                            {
                              type: "img",
                              props: {
                                src: avatarDataUrl,
                                style: {
                                  width: "56px",
                                  height: "56px",
                                  borderRadius: "28px",
                                  objectFit: "cover" as const,
                                },
                              },
                            },
                          ]
                        : []),
                      {
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            flex: "1",
                            overflow: "hidden",
                          },
                          children: [
                            {
                              type: "div",
                              props: {
                                children: displayName,
                                style: {
                                  fontSize: 36,
                                  fontWeight: 700,
                                  color: "#171717",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap" as const,
                                },
                              },
                            },
                            {
                              type: "div",
                              props: {
                                children: `@${handle}`,
                                style: {
                                  fontSize: 20,
                                  color: "#525252",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap" as const,
                                },
                              },
                            },
                          ],
                        },
                      },
                      {
                        type: "div",
                        props: {
                          children: "grain",
                          style: { fontSize: 32, fontFamily: "Syne", fontWeight: 800, color: "#171717", letterSpacing: "-0.02em" },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    options: { fonts: allFonts() },
    meta: {
      title: `${displayName} (@${handle}) — Grain`,
      description: description || `@${handle} on Grain`,
    },
  };
});
